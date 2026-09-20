/** Every successful response has the same shape: { success, data, message }. */
export function ok(res, data = {}, message = null, status = 200) {
  return res.status(status).json({ success: true, data, message });
}

export function created(res, data = {}, message = null) {
  return ok(res, data, message, 201);
}

export function noContent(res) {
  return res.status(204).send();
}

export function paginated(res, items, { page, pageSize, total }, message = null) {
  return ok(res, {
    items,
    pagination: {
      page,
      pageSize,
      total,
      pageCount: pageSize > 0 ? Math.ceil(total / pageSize) : 0,
    },
  }, message);
}
