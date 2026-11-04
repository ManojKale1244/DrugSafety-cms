import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { CaseProduct } from '../models/CaseProduct.js';
import { Case } from '../models/Case.js';
import { auditTrail } from '../utils/audit.js';

/**
 * Calculates exposure latency and timeline window relative to reaction onset.
 *
 * @param {Date|string} prodStart
 * @param {Date|string} prodStop
 * @param {Date|string} rxnStart
 * @returns {{ exposureDurationDays: number|null, timeToOnsetDays: number|null, onsetStatus: string }}
 */
export function calculateExposureTimeline(prodStart, prodStop, rxnStart) {
  let exposureDurationDays = null;
  let timeToOnsetDays = null;
  let onsetStatus = 'UNKNOWN';

  const pStart = prodStart ? new Date(prodStart) : null;
  const pStop = prodStop ? new Date(prodStop) : null;
  const rStart = rxnStart ? new Date(rxnStart) : null;

  if (pStart && !isNaN(pStart.getTime())) {
    if (pStop && !isNaN(pStop.getTime())) {
      const diffMs = pStop.getTime() - pStart.getTime();
      exposureDurationDays = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
    }

    if (rStart && !isNaN(rStart.getTime())) {
      const latencyMs = rStart.getTime() - pStart.getTime();
      timeToOnsetDays = Math.round(latencyMs / (1000 * 60 * 60 * 24));

      if (timeToOnsetDays < 0) {
        onsetStatus = 'BEFORE_EXPOSURE';
      } else if (pStop && !isNaN(pStop.getTime()) && rStart.getTime() > pStop.getTime()) {
        onsetStatus = 'AFTER_STOP';
      } else {
        onsetStatus = 'WITHIN_EXPOSURE';
      }
    }
  }

  return {
    exposureDurationDays,
    timeToOnsetDays,
    onsetStatus,
  };
}

/**
 * Lists products from catalogue with search, pagination, and case usage counts.
 */
export async function listProducts(queryParams = {}) {
  const {
    search,
    status,
    classification,
    atcCode,
    page = 1,
    limit = 20,
    sortBy = 'name',
    sortOrder = 'asc',
  } = queryParams;

  const filter = {};

  if (status) {
    filter.status = status.toUpperCase();
  }

  if (classification) {
    filter.classification = classification;
  }

  if (atcCode) {
    filter['identifiers.atcCode'] = new RegExp(`^${atcCode.trim()}`, 'i');
  }

  if (search && search.trim()) {
    const q = search.trim();
    const regex = new RegExp(q, 'i');
    filter.$or = [
      { name: regex },
      { genericName: regex },
      { productCode: regex },
      { 'identifiers.atcCode': regex },
      { 'identifiers.ndc': regex },
      { manufacturer: regex },
    ];
  }

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const sortDirection = sortOrder === 'desc' ? -1 : 1;
  const sort = { [sortBy]: sortDirection };

  const [products, total] = await Promise.all([
    Product.find(filter).sort(sort).skip(skip).limit(limitNum).lean(),
    Product.countDocuments(filter),
  ]);

  // Aggregate usage count in cases
  const enrichedProducts = await Promise.all(
    products.map(async (prod) => {
      const usageCount = await Case.countDocuments({
        $or: [
          { 'caseProducts.productId': prod._id },
          { 'caseProducts.productName': new RegExp(`^${prod.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
          { product: new RegExp(`^${prod.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        ],
      });
      return {
        ...prod,
        usageCount,
      };
    }),
  );

  return {
    products: enrichedProducts,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    },
  };
}

/**
 * Fetches a single product with case usage details.
 */
export async function getProductById(id) {
  const product = await Product.findById(id).lean();
  if (!product) {
    const err = new Error('Product not found');
    err.statusCode = 404;
    throw err;
  }

  const linkedCases = await Case.find({
    $or: [
      { 'caseProducts.productId': product._id },
      { 'caseProducts.productName': new RegExp(`^${product.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      { product: new RegExp(`^${product.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    ],
  })
    .select('caseNumber receiptDate status priority seriousness')
    .limit(10)
    .lean();

  const usageCount = await Case.countDocuments({
    $or: [
      { 'caseProducts.productId': product._id },
      { 'caseProducts.productName': new RegExp(`^${product.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      { product: new RegExp(`^${product.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    ],
  });

  return {
    product,
    usageCount,
    linkedCases,
  };
}

/**
 * Creates a new product in the central catalogue.
 */
export async function createProduct(data, user = null, req = null) {
  if (!data.name || !data.name.trim()) {
    const err = new Error('Product name is required');
    err.statusCode = 400;
    throw err;
  }

  if (!data.genericName || !data.genericName.trim()) {
    const err = new Error('Generic name (INN) is required');
    err.statusCode = 400;
    throw err;
  }

  const product = await Product.create({
    ...data,
    name: data.name.trim(),
    genericName: data.genericName.trim(),
    createdBy: user?._id || null,
  });

  if (auditTrail) {
    await auditTrail({
      action: 'CREATE',
      entity: 'Product',
      entityId: product._id,
      user,
      req,
      details: {
        productCode: product.productCode,
        name: product.name,
        genericName: product.genericName,
      },
    });
  }

  return product;
}

/**
 * Updates a product in the catalogue.
 */
export async function updateProduct(id, updates, user = null, req = null) {
  const product = await Product.findById(id);
  if (!product) {
    const err = new Error('Product not found');
    err.statusCode = 404;
    throw err;
  }

  Object.assign(product, updates);
  await product.save();

  if (auditTrail) {
    await auditTrail({
      action: 'UPDATE',
      entity: 'Product',
      entityId: product._id,
      user,
      req,
      details: {
        productCode: product.productCode,
        updatedFields: Object.keys(updates),
      },
    });
  }

  return product;
}

/**
 * Deletes product from catalogue ONLY if never referenced in safety cases.
 * Otherwise, rejects and instructs to retire instead.
 */
export async function deleteProduct(id, user = null, req = null) {
  const product = await Product.findById(id);
  if (!product) {
    const err = new Error('Product not found');
    err.statusCode = 404;
    throw err;
  }

  const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const usageCount = await Case.countDocuments({
    $or: [
      { 'caseProducts.productId': product._id },
      { 'caseProducts.productName': new RegExp(`^${escapeRegex(product.name)}$`, 'i') },
      { product: new RegExp(`^${escapeRegex(product.name)}$`, 'i') },
    ],
  });

  if (usageCount > 0) {
    const err = new Error(
      `Cannot delete product "${product.name}" because it is referenced in ${usageCount} safety case(s). Please retire the product instead to preserve audit and regulatory integrity.`,
    );
    err.statusCode = 400;
    err.isReferenced = true;
    err.usageCount = usageCount;
    throw err;
  }

  await Product.findByIdAndDelete(id);

  if (auditTrail) {
    await auditTrail({
      action: 'DELETE',
      entity: 'Product',
      entityId: product._id,
      user,
      req,
      details: {
        productCode: product.productCode,
        name: product.name,
      },
    });
  }

  return { success: true, message: `Product ${product.name} deleted successfully.` };
}

/**
 * Retires a product (safe decommissioning).
 */
export async function retireProduct(id, reason = 'Decommissioned from catalogue', user = null, req = null) {
  const product = await Product.findById(id);
  if (!product) {
    const err = new Error('Product not found');
    err.statusCode = 404;
    throw err;
  }

  product.status = 'RETIRED';
  product.retiredAt = new Date();
  product.retiredReason = reason || 'Decommissioned from safety catalogue';
  await product.save();

  if (auditTrail) {
    await auditTrail({
      action: 'UPDATE',
      entity: 'Product',
      entityId: product._id,
      user,
      req,
      details: {
        action: 'RETIRE',
        productCode: product.productCode,
        retiredReason: product.retiredReason,
      },
    });
  }

  return product;
}

// ─────────────────────────────────────────────────────────────
// In-Case Product Operations (/api/cases/:id/products)
// ─────────────────────────────────────────────────────────────

/**
 * Gets all products associated with a specific Case, enriched with latency calculations.
 */
export async function getCaseProducts(caseId) {
  const caseDoc = await Case.findById(caseId).lean();
  if (!caseDoc) {
    const err = new Error('Case not found');
    err.statusCode = 404;
    throw err;
  }

  // Find reaction onset date for latency calculation
  const rxnOnset =
    caseDoc.reactions?.[0]?.startDate ||
    caseDoc.reactions?.[0]?.receiptDate ||
    caseDoc.receiptDate;

  // Sync / query CaseProduct collection or use embedded caseProducts
  const caseProducts = caseDoc.caseProducts || [];

  const enriched = caseProducts.map((p) => {
    const timeline = calculateExposureTimeline(p.startDate, p.stopDate, rxnOnset);
    return {
      ...p,
      rxnOnset,
      ...timeline,
    };
  });

  return {
    products: enriched,
    rxnOnset,
    caseNumber: caseDoc.caseNumber,
  };
}

/**
 * Adds a product to a Case. Validates stopDate >= startDate and synchronizes case.
 */
export async function addProductToCase(caseId, data, user = null, req = null) {
  const caseDoc = await Case.findById(caseId);
  if (!caseDoc) {
    const err = new Error('Case not found');
    err.statusCode = 404;
    throw err;
  }

  if (!data.productName || !data.productName.trim()) {
    const err = new Error('Product name is required');
    err.statusCode = 400;
    throw err;
  }

  // Validate dates: stopDate >= startDate
  if (data.startDate && data.stopDate) {
    if (new Date(data.stopDate) < new Date(data.startDate)) {
      const err = new Error('Stop date cannot be earlier than start date.');
      err.statusCode = 400;
      throw err;
    }
  }

  // If productId provided, verify catalogue item
  let genericName = data.genericName || '';
  if (data.productId) {
    const catProd = await Product.findById(data.productId).lean();
    if (catProd) {
      if (!genericName) genericName = catProd.genericName;
    }
  }

  const role = data.role
    ? String(data.role).charAt(0).toUpperCase() + String(data.role).slice(1).toLowerCase()
    : 'Suspect';

  const newProduct = {
    productId: data.productId || null,
    productName: data.productName.trim(),
    genericName,
    role,
    dose: data.dose || '',
    frequency: data.frequency || '',
    route: data.route || '',
    indication: data.indication || '',
    actionTaken: data.actionTaken || 'UNKNOWN',
    startDate: data.startDate ? new Date(data.startDate) : null,
    stopDate: data.stopDate ? new Date(data.stopDate) : null,
    lotNumber: data.lotNumber || '',
    expirationDate: data.expirationDate ? new Date(data.expirationDate) : null,
  };

  caseDoc.caseProducts.push(newProduct);

  // Sync legacy product if Suspect
  if (role.toLowerCase() === 'suspect') {
    caseDoc.product = newProduct.productName;
  }

  await caseDoc.save();

  // Create standalone CaseProduct record for relational index
  const savedItem = caseDoc.caseProducts[caseDoc.caseProducts.length - 1];
  await CaseProduct.create({
    _id: savedItem._id,
    caseId: caseDoc._id,
    ...newProduct,
  });

  if (auditTrail) {
    await auditTrail({
      action: 'UPDATE',
      entity: 'Case',
      entityId: caseDoc._id,
      user,
      req,
      details: {
        action: 'ADD_CASE_PRODUCT',
        productName: newProduct.productName,
        role: newProduct.role,
      },
    });
  }

  return savedItem;
}

/**
 * Updates a product in a case. Validates stopDate >= startDate.
 */
export async function updateCaseProduct(caseId, productId, updates, user = null, req = null) {
  const caseDoc = await Case.findById(caseId);
  if (!caseDoc) {
    const err = new Error('Case not found');
    err.statusCode = 404;
    throw err;
  }

  const prod = caseDoc.caseProducts.id(productId);
  if (!prod) {
    const err = new Error('Product not found in this case');
    err.statusCode = 404;
    throw err;
  }

  const newStart = updates.startDate !== undefined ? (updates.startDate ? new Date(updates.startDate) : null) : prod.startDate;
  const newStop = updates.stopDate !== undefined ? (updates.stopDate ? new Date(updates.stopDate) : null) : prod.stopDate;

  if (newStart && newStop && newStop < newStart) {
    const err = new Error('Stop date cannot be earlier than start date.');
    err.statusCode = 400;
    throw err;
  }

  Object.assign(prod, updates);
  if (updates.startDate !== undefined) prod.startDate = newStart;
  if (updates.stopDate !== undefined) prod.stopDate = newStop;

  await caseDoc.save();

  // Sync CaseProduct record
  await CaseProduct.findByIdAndUpdate(productId, updates, { new: true });

  if (auditTrail) {
    await auditTrail({
      action: 'UPDATE',
      entity: 'Case',
      entityId: caseDoc._id,
      user,
      req,
      details: {
        action: 'UPDATE_CASE_PRODUCT',
        productId,
        productName: prod.productName,
      },
    });
  }

  return prod;
}

/**
 * Removes a product from a Case.
 */
export async function removeProductFromCase(caseId, productId, user = null, req = null) {
  const caseDoc = await Case.findById(caseId);
  if (!caseDoc) {
    const err = new Error('Case not found');
    err.statusCode = 404;
    throw err;
  }

  const prod = caseDoc.caseProducts.id(productId);
  if (!prod) {
    const err = new Error('Product not found in this case');
    err.statusCode = 404;
    throw err;
  }

  const removedName = prod.productName;
  caseDoc.caseProducts.pull(productId);
  await caseDoc.save();

  await CaseProduct.findByIdAndDelete(productId);

  if (auditTrail) {
    await auditTrail({
      action: 'UPDATE',
      entity: 'Case',
      entityId: caseDoc._id,
      user,
      req,
      details: {
        action: 'REMOVE_CASE_PRODUCT',
        productId,
        productName: removedName,
      },
    });
  }

  return { success: true, message: `Product ${removedName} removed from case.` };
}

