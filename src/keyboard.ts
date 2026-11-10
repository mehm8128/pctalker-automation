import robot from 'robotjs';

// 修飾キーを押したまま最後のキーを押す。例: ['control', 'shift', 'f1']
export function chord(keys: string[]): void {
  const pressed: string[] = [];
  try {
    for (const k of keys) {
      robot.keyToggle(k, 'down');
      pressed.push(k);
    }
  } finally {
    for (const k of pressed.reverse()) robot.keyToggle(k, 'up');
  }
}
