"use client";

import styles from "./VirtualKeypad.module.css";

const KEYPAD_ROWS = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K"],
  ["M", "N", "P", "Q", "R", "S", "T", "U", "V", "W"],
  ["X", "Y", "Z", "⌫", "C"],
];

interface VirtualKeypadProps {
  onKeyPress: (char: string) => void;
  onBackspace: () => void;
  onClear: () => void;
}

export function VirtualKeypad({ onKeyPress, onBackspace, onClear }: VirtualKeypadProps) {
  return (
    <div className={styles.keypadContainer}>
      <p className={styles.keypadTitle}>Teclado táctil pantalla Tesla</p>
      <div className={styles.grid}>
        {KEYPAD_ROWS.map((row, rIdx) => (
          <div key={rIdx} className={styles.row}>
            {row.map((key) => {
              if (key === "⌫") {
                return (
                  <button
                    key={key}
                    type="button"
                    className={`${styles.keyBtn} ${styles.actionKey}`}
                    onClick={onBackspace}
                    title="Borrar carácter"
                  >
                    ⌫
                  </button>
                );
              }
              if (key === "C") {
                return (
                  <button
                    key={key}
                    type="button"
                    className={`${styles.keyBtn} ${styles.actionKey}`}
                    onClick={onClear}
                    title="Limpiar todo"
                  >
                    C
                  </button>
                );
              }
              return (
                <button
                  key={key}
                  type="button"
                  className={styles.keyBtn}
                  onClick={() => onKeyPress(key)}
                >
                  {key}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
