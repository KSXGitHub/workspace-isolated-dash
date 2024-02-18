import getOrInit from './getOrInit.js'

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

// export const restoreProperty: Map<object, Map<string | number | symbol, () => void>> = new Map()

export function replacePropertyWith<
  Object extends object,
  Key extends keyof Object,
>(
  object: Object,
  key: Key,
  getValue: (oldValue: Object[Key]) => Object[Key],
): PropertyReplacementHandle<Object, Key> {
  // const oldValue = object[key]
  // const newValue = getValue(oldValue)
  // object[key] = newValue

  // const restorePropertyForObject = getOrInit(
  //   restoreProperty,
  //   object,
  //   (): Map<string | number | symbol, () => void> => new Map(),
  // )
  // restorePropertyForObject.set(key, () => {
  //   object[key] = oldValue
  //   restorePropertyForObject.delete(key)
  //   if (restorePropertyForObject.size === 0) {
  //     restoreProperty.delete(restorePropertyForObject)
  //   }
  // })
  return new PropertyReplacementHandle(object, key, getValue)
}

export default replacePropertyWith
