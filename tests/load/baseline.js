import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

/**
 * Baseline Load Test (Onda 4.1 — Performance & Confiabilidade)
 *
 * Valida os SLOs documentados em docs/slo-performance-budget.md:
 *   - p95 latência < 200ms para endpoints críticos
 *   - Error rate < 0.1%
 *
 * Uso:
 *   k6 run tests/load/baseline.js
 *   k6 run tests/load/baseline.js --env BASE_URL=https://staging.example.com --env TOKEN=xxx
 */

const errorRate = new Rate('errors');
const apiLatency = new Trend('api_latency', true);

export const options = {
    stages: [
        { duration: '2m', target: 10 },    // ramp up suave
        { duration: '5m', target: 50 },    // carga nominal (SLO baseline)
        { duration: '2m', target: 100 },   // stress — acima do nominal
        { duration: '1m', target: 0 },     // ramp down
    ],
    thresholds: {
        // Thresholds alinhados com docs/slo-performance-budget.md
        'http_req_duration{endpoint:patients}': ['p95<200'],
        'http_req_duration{endpoint:appointments}': ['p95<200'],
        'http_req_duration{endpoint:health}': ['p95<100'],
        'http_req_failed': ['rate<0.001'],
    },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';
const TOKEN = __ENV.TOKEN || '';

export default function () {
    const headers = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};

    // Endpoint crítico 1 — listagem de pacientes
    const r1 = http.get(`${BASE_URL}/api/v1/crm/patients?limit=20`, {
        headers,
        tags: { endpoint: 'patients' },
    });
    check(r1, { 'patients 200': (r) => r.status === 200 });
    errorRate.add(r1.status !== 200);
    apiLatency.add(r1.timings.duration);

    sleep(0.5);

    // Endpoint crítico 2 — health check
    const r2 = http.get(`${BASE_URL}/health`, {
        tags: { endpoint: 'health' },
    });
    check(r2, { 'health 200': (r) => r.status === 200 });
    errorRate.add(r2.status !== 200);

    sleep(1);
}
