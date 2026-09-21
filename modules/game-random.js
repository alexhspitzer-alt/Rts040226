export function createRandomProvider({ random = Math.random } = {}) {
  function number() {
    return random();
  }

  function int(min, max) {
    const low = Math.ceil(min);
    const high = Math.floor(max);
    return Math.floor(number() * (high - low + 1)) + low;
  }

  function pick(list) {
    if (!Array.isArray(list) || !list.length) return null;
    return list[Math.floor(number() * list.length)];
  }

  function chance(probability) {
    return number() < probability;
  }

  return { number, int, pick, chance };
}

export function createSeededRandom(seed = 1) {
  let value = Number(seed) || 1;
  return createRandomProvider({
    random: () => {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 0x100000000;
    },
  });
}
