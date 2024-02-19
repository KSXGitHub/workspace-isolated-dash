import Shell from 'gi://Shell'

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js'

import WorkspaceIsolator from './WorkspaceIsolator.js'

export default class WorkspaceIsolatedDashExtension extends Extension {
  private _appSystem: Shell.AppSystem
  private _wsIsolator: WorkspaceIsolator

  public enable(): void {
    this._appSystem = Shell.AppSystem.get_default()
    this._wsIsolator = new WorkspaceIsolator(this._appSystem)
    this._wsIsolator.refresh()
  }

  public disable(): void {
    this._wsIsolator.destroy()
    this._wsIsolator = null as any
    this._appSystem = null as any
  }
}
