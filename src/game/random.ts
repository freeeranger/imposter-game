export const rollChance = (percent: number) => Math.random() < percent / 100;

export const randomPlayerNumber = (playersCount: number) =>
  Math.floor(Math.random() * playersCount) + 1;

export const pickRandom = <T>(items: T[]): T =>
  items[Math.floor(Math.random() * items.length)];

export const shuffle = <T>(items: T[]): T[] => {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }

  return shuffled;
};
