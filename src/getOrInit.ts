export function getOrInit<Key, Value>(map: Map<Key, Value>, key: Key, init: () => Value): Value {
  if (map.has(key)) return map.get(key)!
  const value = init()
  map.set(key, value)
  return value
}

export default getOrInit
