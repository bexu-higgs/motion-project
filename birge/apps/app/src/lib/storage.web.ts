/** Веб: баптаулар да, сессия токені де браузердің localStorage-інде. */
function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // жеке режим немесе бұғатталған сақтау — сессия тек осы бетте қалады
  }
}

const store = {
  async get(key: string): Promise<string | null> {
    return read(key);
  },
  async set(key: string, value: string): Promise<void> {
    write(key, value);
  },
  async remove(key: string): Promise<void> {
    write(key, null);
  },
};

export const prefs = store;
export const secure = store;
