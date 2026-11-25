export interface Step {
  name?: string;
  // as_info の procedure(AS テストの手順の単位)。同じ値のステップは 1 つにまとめて出力する。省略すると直前のステップと同じ
  procedure?: string;
  keys: string[];
  until?: string;
  waitMs?: number;
  copy?: boolean;
}

export interface Scenario {
  testId?: string;
  title?: string;
  url: string;
  steps: Step[];
}

export interface StepResult {
  testId?: string;
  title?: string;
  index: number;
  name: string;
  procedure?: string;
  keys: string[];
  presses: number;
  speech: string[];
  reached?: boolean;
  stalled?: boolean;
}
