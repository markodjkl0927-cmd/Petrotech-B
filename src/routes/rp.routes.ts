import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { authenticate, authorize } from '../middleware/auth';
import { rpAuthController } from '../controllers/rp-auth.controller';
import { rpMemberController } from '../controllers/rp-member.controller';
import { rpLocatorController } from '../controllers/rp-locator.controller';
import { rpCareerController } from '../controllers/rp-career.controller';
import { rpDealershipController } from '../controllers/rp-dealership.controller';
import { rpAdminController } from '../controllers/rp-admin.controller';
import { getEmailTransport } from '../services/email.service';

const router = Router();

const careerUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dest = path.join(process.cwd(), 'uploads', 'rp', 'careers');
      fs.mkdirSync(dest, { recursive: true });
      cb(null, dest);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase() || '.pdf';
      const memberId = (req as any).user?.userId || 'member';
      cb(null, `${memberId}-${Date.now()}${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    const allowed =
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'application/msword' ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (!allowed) {
      return cb(new Error('Only PDF or Word documents are allowed'));
    }
    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Public — verify email env is loaded on production (no secrets exposed)
router.get('/email/status', (_req, res) => {
  res.json({
    configured: getEmailTransport() !== 'none',
    transport: getEmailTransport(),
    from: process.env.SMTP_FROM?.trim() || 'noreply@randpglobalenergies.com',
    note:
      getEmailTransport() === 'resend-api'
        ? 'Uses Resend HTTP API (required on Render — SMTP port 587 is blocked)'
        : undefined,
  });
});

// Public auth
router.post('/auth/register', rpAuthController.register);
router.post('/auth/login', rpAuthController.login);
router.post('/auth/admin/login', rpAuthController.adminLogin);
router.post('/auth/recover-account', rpAuthController.recoverAccount);
router.post('/auth/forgot-password', rpAuthController.forgotPassword);
router.post('/auth/reset-password', rpAuthController.resetPassword);

console.log('[R&P routes] account recovery: POST /api/rp/auth/recover-account, /forgot-password, /reset-password');

// Public locator (no login required to browse stations)
router.get('/locator/states', rpLocatorController.listStates);
router.get('/locator/cities', rpLocatorController.listCities);
router.get('/locator/locations', rpLocatorController.listLocations);

// Public careers list
router.get('/careers', rpCareerController.listJobs);
router.get('/careers/:id', rpCareerController.getJob);

// Member routes
router.get('/member/me', authenticate, authorize('RP_MEMBER'), rpMemberController.me);
router.put('/member/me', authenticate, authorize('RP_MEMBER'), rpMemberController.updateProfile);
router.put('/member/password', authenticate, authorize('RP_MEMBER'), rpMemberController.changePassword);
router.get('/member/card', authenticate, authorize('RP_MEMBER'), rpMemberController.card);
router.get('/member/applications', authenticate, authorize('RP_MEMBER'), rpMemberController.listApplications);
router.get('/member/dashboard/stats', authenticate, authorize('RP_MEMBER'), rpMemberController.getDashboardStats);
router.post(
  '/careers/:id/apply',
  authenticate,
  authorize('RP_MEMBER'),
  careerUpload.single('resume'),
  rpCareerController.apply
);
router.post(
  '/dealership/apply',
  authenticate,
  authorize('RP_MEMBER'),
  rpDealershipController.submit
);

// Admin routes
router.use('/admin', authenticate, authorize('RP_ADMIN'));

router.get('/admin/dashboard/stats', rpAdminController.getDashboardStats);
router.get('/admin/locations', rpAdminController.listLocations);
router.post('/admin/locations', rpAdminController.createLocation);
router.post('/admin/locations/geocode-missing', rpAdminController.geocodeMissingLocations);
router.put('/admin/locations/:id', rpAdminController.updateLocation);
router.delete('/admin/locations/:id', rpAdminController.deleteLocation);

router.get('/admin/careers', rpAdminController.listJobs);
router.post('/admin/careers', rpAdminController.createJob);
router.put('/admin/careers/:id', rpAdminController.updateJob);
router.delete('/admin/careers/:id', rpAdminController.deleteJob);
router.get('/admin/career-applications', rpAdminController.listCareerApplications);
router.patch('/admin/career-applications/:id', rpAdminController.updateCareerStatus);

router.get('/admin/dealership-applications', rpAdminController.listDealershipApplications);
router.patch('/admin/dealership-applications/:id', rpAdminController.updateDealershipStatus);

router.get('/admin/members', rpAdminController.listMembers);
router.get('/admin/members/:id', rpAdminController.getMember);
router.patch('/admin/members/:id', rpAdminController.updateMember);

export default router;
