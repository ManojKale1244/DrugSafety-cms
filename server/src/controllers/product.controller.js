import * as productService from '../services/product.service.js';

// ── Catalogue Controllers ────────────────────────────────────

export async function listProductsHandler(req, res) {
  try {
    const result = await productService.listProducts(req.query);
    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({ success: false, message: err.message });
  }
}

export async function getProductByIdHandler(req, res) {
  try {
    const result = await productService.getProductById(req.params.id);
    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    const status = err.statusCode || 404;
    return res.status(status).json({ success: false, message: err.message });
  }
}

export async function createProductHandler(req, res) {
  try {
    const product = await productService.createProduct(req.body, req.user, req);
    return res.status(201).json({
      success: true,
      product,
    });
  } catch (err) {
    const status = err.statusCode || 400;
    return res.status(status).json({ success: false, message: err.message });
  }
}

export async function updateProductHandler(req, res) {
  try {
    const product = await productService.updateProduct(req.params.id, req.body, req.user, req);
    return res.status(200).json({
      success: true,
      product,
    });
  } catch (err) {
    const status = err.statusCode || 400;
    return res.status(status).json({ success: false, message: err.message });
  }
}

export async function deleteProductHandler(req, res) {
  try {
    const result = await productService.deleteProduct(req.params.id, req.user, req);
    return res.status(200).json(result);
  } catch (err) {
    const status = err.statusCode || 400;
    return res.status(status).json({
      success: false,
      message: err.message,
      isReferenced: err.isReferenced || false,
      usageCount: err.usageCount || 0,
    });
  }
}

export async function retireProductHandler(req, res) {
  try {
    const { reason } = req.body;
    const product = await productService.retireProduct(req.params.id, reason, req.user, req);
    return res.status(200).json({
      success: true,
      product,
      message: `Product ${product.name} retired successfully.`,
    });
  } catch (err) {
    const status = err.statusCode || 400;
    return res.status(status).json({ success: false, message: err.message });
  }
}

// ── In-Case Product Controllers ──────────────────────────────

export async function getCaseProductsHandler(req, res) {
  try {
    const result = await productService.getCaseProducts(req.params.id);
    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({ success: false, message: err.message });
  }
}

export async function addProductToCaseHandler(req, res) {
  try {
    const product = await productService.addProductToCase(req.params.id, req.body, req.user, req);
    return res.status(201).json({
      success: true,
      product,
    });
  } catch (err) {
    const status = err.statusCode || 400;
    return res.status(status).json({ success: false, message: err.message });
  }
}

export async function updateCaseProductHandler(req, res) {
  try {
    const product = await productService.updateCaseProduct(
      req.params.id,
      req.params.productId,
      req.body,
      req.user,
      req,
    );
    return res.status(200).json({
      success: true,
      product,
    });
  } catch (err) {
    const status = err.statusCode || 400;
    return res.status(status).json({ success: false, message: err.message });
  }
}

export async function removeProductFromCaseHandler(req, res) {
  try {
    const result = await productService.removeProductFromCase(
      req.params.id,
      req.params.productId,
      req.user,
      req,
    );
    return res.status(200).json(result);
  } catch (err) {
    const status = err.statusCode || 400;
    return res.status(status).json({ success: false, message: err.message });
  }
}

