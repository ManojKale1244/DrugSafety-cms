import { ZodError } from 'zod';

/**
 * Middleware factory for validating incoming request objects using Zod.
 *
 * @param {import('zod').ZodSchema} schema
 * @param {'body'|'query'|'params'} [target='body']
 */
export function validate(schema, target = 'body') {
  return async (req, res, next) => {
    try {
      const parsed = await schema.parseAsync(req[target]);
      req[target] = parsed;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          issues,
        });
      }
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
      });
    }
  };
}
