interface RequestMetricInput {
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
}

interface MetricsState {
  startedAtMs: number;
  requestsTotal: number;
  requestsByKey: Map<string, number>;
  requestDurationSumMs: number;
}

const state: MetricsState = {
  startedAtMs: Date.now(),
  requestsTotal: 0,
  requestsByKey: new Map<string, number>(),
  requestDurationSumMs: 0
};

function normalizeRoute(route: string): string {
  if (!route || route.length === 0) return 'unknown';
  return route.replace(/\s+/g, '_');
}

export function recordRequestMetric(input: RequestMetricInput): void {
  const method = input.method.toUpperCase();
  const route = normalizeRoute(input.route);
  const status = String(input.statusCode);
  const key = `${method}|${route}|${status}`;

  state.requestsTotal += 1;
  state.requestDurationSumMs += Math.max(0, input.durationMs);
  state.requestsByKey.set(key, (state.requestsByKey.get(key) ?? 0) + 1);
}

export function renderPrometheusMetrics(): string {
  const lines: string[] = [];

  lines.push('# HELP clawville_process_uptime_seconds Process uptime in seconds');
  lines.push('# TYPE clawville_process_uptime_seconds gauge');
  lines.push(`clawville_process_uptime_seconds ${Math.floor((Date.now() - state.startedAtMs) / 1000)}`);

  lines.push('# HELP clawville_http_requests_total Total count of HTTP requests');
  lines.push('# TYPE clawville_http_requests_total counter');
  lines.push(`clawville_http_requests_total ${state.requestsTotal}`);

  lines.push('# HELP clawville_http_request_duration_ms_sum Total request duration in milliseconds');
  lines.push('# TYPE clawville_http_request_duration_ms_sum counter');
  lines.push(`clawville_http_request_duration_ms_sum ${state.requestDurationSumMs.toFixed(2)}`);

  lines.push('# HELP clawville_http_requests_by_route_total HTTP requests grouped by method/route/status');
  lines.push('# TYPE clawville_http_requests_by_route_total counter');
  for (const [key, value] of state.requestsByKey.entries()) {
    const [method, route, status] = key.split('|');
    lines.push(
      `clawville_http_requests_by_route_total{method="${method}",route="${route}",status_code="${status}"} ${value}`
    );
  }

  return `${lines.join('\n')}\n`;
}
