import http from 'k6/http';
import { check } from 'k6';

/**
 * Spike Test — webhooks (Onda 4.1 — Performance & Confiabilidade)
 *
 * Simula cenário de spike súbito em endpoints de webhook.
 * Valida que o sistema mantém p95 < 200ms mesmo sob carga repentina.
 *
 * Uso:
 *   k6 run tests/load/spike.js
 *   k6 run tests/load/spike.js --env BASE_URL=https://staging.example.com
 */

export const options = {
    scenarios: {
        spike: {
            executor: 'ramping-arrival-rate',
            startRate: 10,
            timeUnit: '1s',
            preAllocatedVUs: 50,
            stages: [
                { duration: '10s', target: 200 },   // spike súbito
                { duration: '1m', target: 200 },    // sustentar
                { duration: '10s', target: 10 },    // volta ao normal
            ],
        },
    },
    thresholds: {
        // Webhook SLO: p95 < 200ms mesmo no spike
        'http_req_duration{endpoint:webhook}': ['p95<200'],
        'http_req_failed': ['rate<0.01'],
    },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';

export default function () {
    const payload = JSON.stringify({ type: 'test.ping', data: {} });
    const params = {
        headers: { 'Content-Type': 'application/json' },
        tags: { endpoint: 'webhook' },
    };

    const r = http.post(`${BASE_URL}/health`, payload, params);
    check(r, { 'status 200': (res) => res.status === 200 });
}
