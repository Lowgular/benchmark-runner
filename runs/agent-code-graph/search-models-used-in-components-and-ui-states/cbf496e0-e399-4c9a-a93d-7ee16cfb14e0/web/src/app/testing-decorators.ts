type LocalClassDecorator = (target: Function) => void;

export function Component(_metadata: unknown): LocalClassDecorator {
  return () => undefined;
}

export function Injectable(): LocalClassDecorator {
  return () => undefined;
}
