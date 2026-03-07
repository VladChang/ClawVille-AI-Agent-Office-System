export type RuntimeMode = 'mock' | 'local' | 'real';

const runtimeModeFromEnv = process.env.NEXT_PUBLIC_RUNTIME_MODE;
const useMockApiFlag = process.env.NEXT_PUBLIC_USE_MOCK_API === 'true';

function isRuntimeMode(value: string | undefined): value is RuntimeMode {
  return value === 'mock' || value === 'local' || value === 'real';
}

export function getRuntimeMode(): RuntimeMode {
  if (isRuntimeMode(runtimeModeFromEnv)) {
    return runtimeModeFromEnv;
  }

  // Backward compatibility with old flag.
  if (useMockApiFlag) {
    return 'mock';
  }

  // Development defaults to local fallback mode, production stays real.
  return process.env.NODE_ENV === 'production' ? 'real' : 'local';
}
