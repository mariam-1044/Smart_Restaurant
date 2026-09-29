jest.mock('../../src/domain/models/AIInferenceAudit', () => ({
    create: jest.fn()
}));

const AIInferenceAudit = require('../../src/domain/models/AIInferenceAudit');
const auditService = require('../../src/application/services/audit.service');

describe('audit.service.recordInference', () => {
    beforeEach(() => jest.clearAllMocks());

    test('inserts a row with the provided fields', async () => {
        AIInferenceAudit.create.mockResolvedValueOnce({ _id: 'a1' });
        await auditService.recordInference({
            callerId: 'u1',
            callerRole: 'admin',
            capability: 'forecast',
            route: '/api/v1/ai/forecast',
            method: 'POST',
            outcome: 'success',
            latencyMs: 42,
            inputSummary: { 'body.dishId': 'aaa' },
            errorCode: null,
            correlationId: 'corr-1'
        });
        expect(AIInferenceAudit.create).toHaveBeenCalledWith(expect.objectContaining({
            callerId: 'u1',
            callerRole: 'admin',
            capability: 'forecast',
            outcome: 'success',
            latencyMs: 42,
            correlationId: 'corr-1'
        }));
    });

    test('swallows insertion errors so the request never fails on audit', async () => {
        AIInferenceAudit.create.mockRejectedValueOnce(new Error('boom'));
        await expect(auditService.recordInference({
            callerRole: 'admin',
            capability: 'forecast',
            route: '/x',
            method: 'POST',
            outcome: 'success',
            latencyMs: 1
        })).resolves.toBeUndefined();
    });

    test('uses defaults for optional fields', async () => {
        AIInferenceAudit.create.mockResolvedValueOnce({});
        await auditService.recordInference({
            callerRole: 'public',
            capability: 'recipe',
            route: '/x',
            method: 'POST',
            outcome: 'success',
            latencyMs: 0
        });
        const call = AIInferenceAudit.create.mock.calls[0][0];
        expect(call.callerId).toBeNull();
        expect(call.errorCode).toBeNull();
        expect(call.correlationId).toBeNull();
        expect(call.inputSummary).toEqual({});
    });
});
