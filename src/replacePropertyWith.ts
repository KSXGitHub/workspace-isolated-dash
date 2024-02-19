export class PropertyReplacementHandle<Object extends object, Key extends keyof Object> {
  private _object: Object
  private _key: Key
  private _oldValue: Object[Key]

  public constructor(object: Object, key: Key, getValue: (oldValue: Object[Key]) => Object[Key]) {
    this._object = object
    this._key = key
    const oldValue = this._oldValue = object[key]
    const newValue = getValue(oldValue)
    object[key] = newValue
  }

  public restore(): void {
    this._object[this._key] = this._oldValue
  }
}

export function replacePropertyWith<
  Object extends object,
  Key extends keyof Object,
>(
  object: Object,
  key: Key,
  getValue: (oldValue: Object[Key]) => Object[Key],
): PropertyReplacementHandle<Object, Key> {
  return new PropertyReplacementHandle(object, key, getValue)
}

export default replacePropertyWith
