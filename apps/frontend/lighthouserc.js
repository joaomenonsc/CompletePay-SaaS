/** @type {import('@lhci/types').LighthouseRcConfig} */
module.exports = {
    ci: {
        collect: {
            startServerCommand: 'npm run start',
            startServerReadyPattern: 'ready on',
            url: ['http://localhost:3000/dashboard/default'],
            numberOfRuns: 3,
        },
        assert: {
            // Thresholds alinhados com docs/slo-performance-budget.md
            assertions: {
                'categories:performance': ['error', { minScore: 0.8 }],
                'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
                'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
                'first-contentful-paint': ['warn', { maxNumericValue: 2000 }],
                'total-blocking-time': ['warn', { maxNumericValue: 300 }],
                'interactive': ['warn', { maxNumericValue: 3500 }],
            },
        },
        upload: {
            target: 'temporary-public-storage',
        },
    },
};
