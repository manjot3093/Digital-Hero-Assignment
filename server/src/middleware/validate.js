/**
 * Runs a Zod schema over the request and replaces the raw input with the
 * parsed, coerced result, so controllers always receive clean data.
 */
export function validate(schemas) {
  return (req, _res, next) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) req.validatedQuery = schemas.query.parse(req.query);
      if (schemas.params) req.params = schemas.params.parse(req.params);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export default validate;
