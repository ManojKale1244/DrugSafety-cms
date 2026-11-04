import {
  exportCaseIcsr,
  previewIcsrImport,
  confirmIcsrImport,
  mockGatewayAcknowledge,
  SYNTHETIC_E2B_NOTICE,
} from '../services/icsrMapper.service.js';
import { IcsrMessage } from '../models/IcsrMessage.js';
import { IcsrAcknowledgement } from '../models/IcsrAcknowledgement.js';

/**
 * Exports a Case as synthetic ICSR E2B payload (JSON or XML).
 * POST /api/icsr/export/:caseId
 */
export async function exportCaseHandler(req, res) {
  try {
    const { caseId } = req.params;
    const format = req.body?.format || req.query?.format || 'JSON';

    const result = await exportCaseIcsr(caseId, format, req.user, req);

    return res.status(200).json({
      success: true,
      messageId: result.message.messageId,
      format: result.format,
      payload: result.payload,
      validation: result.validation,
      disclaimer: SYNTHETIC_E2B_NOTICE,
    });
  } catch (err) {
    return res.status(err.message === 'Case not found' ? 404 : 400).json({
      success: false,
      message: err.message,
    });
  }
}

/**
 * Previews an inbound ICSR XML or JSON payload without saving intake.
 * POST /api/icsr/preview
 */
export async function previewImportHandler(req, res) {
  try {
    const { payload, format } = req.body;
    if (!payload) {
      return res.status(400).json({
        success: false,
        message: 'Payload is required for ICSR preview',
      });
    }

    const preview = await previewIcsrImport(payload, format || 'AUTO');

    return res.status(200).json({
      success: true,
      ...preview,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
}

/**
 * Confirms ICSR import: creates an Intake record and saves IcsrMessage.
 * POST /api/icsr/import
 */
export async function confirmImportHandler(req, res) {
  try {
    const { payload, format } = req.body;
    if (!payload) {
      return res.status(400).json({
        success: false,
        message: 'Payload is required for ICSR import',
      });
    }

    const result = await confirmIcsrImport(payload, format || 'AUTO', req.user, req);

    return res.status(201).json({
      success: true,
      intake: result.intake,
      message: result.message,
      duplicateScreening: result.duplicateScreening,
      disclaimer: SYNTHETIC_E2B_NOTICE,
    });
  } catch (err) {
    const status = err.statusCode || 400;
    return res.status(status).json({
      success: false,
      message: err.message,
      validationErrors: err.validationErrors || [],
    });
  }
}

/**
 * Fetches all ICSR messages with optional filtering.
 * GET /api/icsr/messages
 */
export async function getMessagesHandler(req, res) {
  try {
    const {
      direction,
      format,
      status,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    const query = {};
    if (direction) query.direction = direction.toUpperCase();
    if (format) query.format = format.toUpperCase();
    if (status) query.status = status.toUpperCase();

    if (search) {
      query.$or = [
        { messageId: { $regex: search, $options: 'i' } },
        { caseNumber: { $regex: search, $options: 'i' } },
        { intakeNumber: { $regex: search, $options: 'i' } },
        { senderIdentifier: { $regex: search, $options: 'i' } },
        { receiverIdentifier: { $regex: search, $options: 'i' } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [messages, total] = await Promise.all([
      IcsrMessage.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('createdBy', 'name email role')
        .lean(),
      IcsrMessage.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      messages,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
      disclaimer: SYNTHETIC_E2B_NOTICE,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

/**
 * Fetches single ICSR message with acknowledgements.
 * GET /api/icsr/messages/:id
 */
export async function getMessageByIdHandler(req, res) {
  try {
    const { id } = req.params;

    const message = await IcsrMessage.findById(id).populate('createdBy', 'name email role');
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    const acknowledgements = await IcsrAcknowledgement.find({ messageId: message._id })
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email role');

    return res.status(200).json({
      success: true,
      message,
      acknowledgements,
      disclaimer: SYNTHETIC_E2B_NOTICE,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

/**
 * Simulates health authority gateway acknowledgment.
 * POST /api/icsr/gateway/mock-ack/:messageId
 */
export async function mockGatewayAckHandler(req, res) {
  try {
    const { messageId } = req.params;
    const { ackCode = 'ACK_OK', note = '' } = req.body;

    const result = await mockGatewayAcknowledge(messageId, ackCode, note, req.user, req);

    return res.status(200).json({
      success: true,
      acknowledgement: result.ack,
      message: result.message,
      disclaimer: SYNTHETIC_E2B_NOTICE,
    });
  } catch (err) {
    return res.status(err.message === 'ICSR message not found' ? 404 : 400).json({
      success: false,
      message: err.message,
    });
  }
}

