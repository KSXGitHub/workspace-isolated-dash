import type Meta from 'gi://Meta'
import Shell from 'gi://Shell'
import type St from 'gi://St'

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js'
import { AppIcon } from 'resource:///org/gnome/shell/ui/appDisplay.js'
import * as Main from 'resource:///org/gnome/shell/ui/main.js'

import { replacePropertyWith, type PropertyReplacementHandle } from './replacePropertyWith.js'

type _AppIcon = AppIcon & {
  _updateRunningStyle: AppIcon['updateRunningStyle']
  _dot: St.Widget
}

class WorkspaceIsolator {
  private _onSwitchWorkspaceId: number
  private _onRestackedId: number
  private _appSystem: Shell.AppSystem
  private _methodInjections: {
    'this._appSystem.get_running'?: PropertyReplacementHandle<Shell.AppSystem, 'get_running'>
    'Shell.App.prototype.activate'?: PropertyReplacementHandle<Shell.App, 'activate'>
    'AppIcon.prototype._updateRunningStyle'?: PropertyReplacementHandle<_AppIcon, '_updateRunningStyle'>
    'AppIcon.prototype.updateRunningStyle'?: PropertyReplacementHandle<AppIcon, 'updateRunningStyle'>
  }

  public constructor(_appSystem: Shell.AppSystem) {
    this._appSystem = _appSystem
    this._methodInjections = {}

    // Extend AppSystem to only return applications running on the active workspace
    this._methodInjections['this._appSystem.get_running'] = replacePropertyWith(
      this._appSystem,
      'get_running',
      old_get_running =>
        function (this: Shell.AppSystem): Shell.App[] {
          let running: Shell.App[] = old_get_running.call(this)
          if (Main.overview.visible) {
            return running.filter(WorkspaceIsolator.isActiveApp)
          } else {
            return running
          }
        },
    )

    // Extend App's activate to open a new window if no windows exist on the active workspace
    this._methodInjections['Shell.App.prototype.activate'] = replacePropertyWith(
      Shell.App.prototype,
      'activate',
      old_activate =>
        function (this: Shell.App): void {
          if (WorkspaceIsolator.isActiveApp(this)) {
            return old_activate.call(this)
          }
          return this.open_new_window(-1)
        },
    )

    // Extend AppIcon's state change to hide 'running' indicator for applications not on the active workspace
    type _AppIcon = AppIcon & {
      _updateRunningStyle: AppIcon['updateRunningStyle']
      _dot: St.Widget
    }
    const inject_updateRunningStyle = (old_updateRunningStyle: AppIcon['updateRunningStyle']) =>
      function (this: _AppIcon): void {
        if (WorkspaceIsolator.isActiveApp(this.app)) {
          old_updateRunningStyle.call(this)
        } else {
          this._dot.hide()
        }
      }
    this._methodInjections['AppIcon.prototype._updateRunningStyle'] = replacePropertyWith(
      AppIcon.prototype as _AppIcon,
      '_updateRunningStyle',
      inject_updateRunningStyle,
    )
    this._methodInjections['AppIcon.prototype.updateRunningStyle'] = replacePropertyWith(
      AppIcon.prototype,
      'updateRunningStyle',
      inject_updateRunningStyle,
    )

    // Refresh when the workspace is switched
    this._onSwitchWorkspaceId = global.windowManager.connect('switch-workspace', () => this.refresh())

    // Refresh whenever there is a restack, including:
    // - window moved to another workspace
    // - window created
    // - window closed
    this._onRestackedId = global.display.connect('restacked', () => this.refresh())
  }

  public destroy(): void {
    // Revert the normal functions
    for (const [name, handle] of Object.entries(this._methodInjections)) {
      console.info(`Restoring ${name} to normal...`)
      handle.restore()
    }
    this._methodInjections = {}

    // Disconnect the restacked signal
    if (this._onRestackedId) {
      global.display.disconnect(this._onRestackedId)
      this._onRestackedId = 0
    }
    // Disconnect the switch-workspace signal
    if (this._onSwitchWorkspaceId) {
      global.windowManager.disconnect(this._onSwitchWorkspaceId)
      this._onSwitchWorkspaceId = 0
    }
  }

  public static isActiveApp(app: Shell.App): boolean {
    return app.is_on_workspace(global.workspaceManager.get_active_workspace())
  }

  public refresh(): void {
    // Update icon state of all running applications
    const running = this._appSystem.get_running()
    for (const app of running) {
      app.notify('state')
    }

    // Update applications shown in the dash
    let dash = Main.overview._dash || Main.overview.dash
    dash._queueRedisplay()
  }
}

export default class WorkspaceIsolatedDashExtension extends Extension {
  private _data: {
    appSystem: Shell.AppSystem
    wsIsolator: WorkspaceIsolator
  } | null

  public enable(): void {
    type PossibleAppSystem = Shell.AppSystem | Shell.WM | Meta.Display // get_default doesn't always return the right type
    const appSystem: PossibleAppSystem = Shell.AppSystem.get_default()
    if (!(appSystem instanceof Shell.AppSystem)) {
      console.warn(`Shell.AppSystem.get_default() returned ${appSystem}, which is not a Shell.AppSystem. Ignored.`)
      this._data = null
      return
    }
    const wsIsolator = new WorkspaceIsolator(appSystem)
    this._data = {
      appSystem,
      wsIsolator,
    }
    wsIsolator.refresh()
  }

  public disable(): void {
    if (!this._data) return
    this._data.wsIsolator.destroy()
    this._data.wsIsolator = null as any
    this._data.appSystem = null as any
    this._data = null
  }
}
