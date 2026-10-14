import {
  createIntake,
  getIntakes,
  getIntakeById,
  updateIntake,
  convertIntakeToCase,
  rejectIntake,
} from '../services/intake.service.js';

export async function listIntakes(req, res, next) {
  try {
    const { search, status, source, page, limit } = req.query;
    const result = await getIntakes({ search, status, source, page, limit });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function getIntake(req, res, next) {
  try {
    const intake = await getIntakeById(req.params.id);
    if (!intake) {
      return res.status(404).json({ success: false, error: 'Intake record not found' });
    }
    return res.status(200).json({ success: true, intake });
  } catch (error) {
    next(error);
  }
}

export async function createIntakeRecord(req, res, next) {
  try {
    const result = await createIntake(req.body, req.user, req);
    if (!result.success) {
      return res.status(result.statusCode || 400).json({
        success: false,
        error: result.error,
      });
    }
    return res.status(201).json({
      success: true,
      message: `Intake ${result.intake.intakeNumber} created successfully`,
      intake: result.intake,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateIntakeRecord(req, res, next) {
  try {
    const result = await updateIntake(req.params.id, req.body, req.user, req);
    if (!result.success) {
      return res.status(result.statusCode || 400).json({
        success: false,
        error: result.error,
      });
    }
    return res.status(200).json({
      success: true,
      message: `Intake ${result.intake.intakeNumber} updated successfully`,
      intake: result.intake,
    });
  } catch (error) {
    next(error);
  }
}

export async function convertIntake(req, res, next) {
  try {
    const result = await convertIntakeToCase(req.params.id, req.user, req);
    if (!result.success) {
      return res.status(result.statusCode || 400).json({
        success: false,
        error: result.error,
        missingFields: result.missingFields,
      });
    }
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function rejectIntakeRecord(req, res, next) {
  try {
    const result = await rejectIntake(req.params.id, req.body.reason, req.user, req);
    if (!result.success) {
      return res.status(result.statusCode || 400).json({
        success: false,
        error: result.error,
      });
    }
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
