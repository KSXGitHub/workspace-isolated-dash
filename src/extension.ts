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
    'this._appSystem.get_running'?: PropertyReplacementHandle<Shell.AppSystem, "get_running">
    'Shell.App.prototype.activate'?: PropertyReplacementHandle<Shell.App, "activate">
    'AppIcon.prototype._updateRunningStyle'?: PropertyReplacementHandle<_AppIcon, "_updateRunningStyle">
    'AppIcon.prototype.updateRunningStyle'?: PropertyReplacementHandle<AppIcon, "updateRunningStyle">
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
          let running = old_get_running.call(this)
          if (Main.overview.visible) {
            return running.filter(WorkspaceIsolator.isActiveApp)
          } else {
            return running
          }
        },
    )

    // Extend App's activate to open a new window if no windows exist on the active workspace
    this._methodInjections['Shell.App.prototype.activate'] = replacePropertyWith(Shell.App.prototype, 'activate', old_activate =>
      function (this: Shell.App): void {
        if (WorkspaceIsolator.isActiveApp(this)) {
          return old_activate.call(this)
        }
        return this.open_new_window(-1)
      })

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
    this._methodInjections['AppIcon.prototype._updateRunningStyle'] = replacePropertyWith(AppIcon.prototype as _AppIcon, '_updateRunningStyle', inject_updateRunningStyle)
    this._methodInjections['AppIcon.prototype.updateRunningStyle'] = replacePropertyWith(AppIcon.prototype, 'updateRunningStyle', inject_updateRunningStyle)

    // Refresh when the workspace is switched
    this._onSwitchWorkspaceId = global.windowManager.connect('switch-workspace', WorkspaceIsolator.refresh)

    // Refresh whenever there is a restack, including:
    // - window moved to another workspace
    // - window created
    // - window closed
    this._onRestackedId = global.display.connect('restacked', WorkspaceIsolator.refresh)
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

  public static refresh(appSystem?: Shell.AppSystem): void {
    const AppSystem = appSystem || Shell.AppSystem.get_default()

    // Update icon state of all running applications
    const running = AppSystem.get_running() // NOTE: get_running may or may not be injected, depends on whether _appSystem is defined or not
    for (const app of running) {
      app.notify('state')
    }

    // Update applications shown in the dash
    let dash = Main.overview._dash || Main.overview.dash
    dash._queueRedisplay()
  }
}

export default class WorkspaceIsolatedDashExtension extends Extension {
  private _appSystem: Shell.AppSystem
  private _wsIsolator: WorkspaceIsolator

  public enable(): void {
    this._appSystem = Shell.AppSystem.get_default()
    this._wsIsolator = new WorkspaceIsolator(this._appSystem)
    WorkspaceIsolator.refresh()
  }

  public disable(): void {
    this._wsIsolator.destroy()
    this._wsIsolator = null as any
    WorkspaceIsolator.refresh()
    this._appSystem = null as any
  }
}
