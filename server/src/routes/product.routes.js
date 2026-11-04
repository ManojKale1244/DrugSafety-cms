import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import * as productController from '../controllers/product.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('case.read'), productController.listProductsHandler);
router.post('/', requirePermission('case.create'), productController.createProductHandler);

router.get('/:id', requirePermission('case.read'), productController.getProductByIdHandler);
router.patch('/:id', requirePermission('case.update'), productController.updateProductHandler);
router.delete('/:id', requirePermission('case.update'), productController.deleteProductHandler);
router.post('/:id/retire', requirePermission('case.update'), productController.retireProductHandler);

export default router;

