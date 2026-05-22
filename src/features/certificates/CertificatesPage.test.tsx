import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n/config';
import i18n from '../../i18n/config';
import { CertificatesPage } from './CertificatesPage';

const api = vi.hoisted(() => ({
  approveCertificate: vi.fn(),
  downloadCertificatePdf: vi.fn(),
  getCertificateBranding: vi.fn(),
  getCourseCertificateSettings: vi.fn(),
  issueCourseCertificate: vi.fn(),
  listCourseCertificates: vi.fn(),
  listCourseGroups: vi.fn(),
  listCourseStudents: vi.fn(),
  listTenantCourses: vi.fn(),
  previewCourseCertificate: vi.fn(),
  regenerateCourseCertificates: vi.fn(),
  rejectCertificate: vi.fn(),
  revokeCertificate: vi.fn(),
  updateCertificateBranding: vi.fn(),
  updateCourseCertificateSettings: vi.fn(),
  uploadCertificateLogo: vi.fn(),
  uploadCourseCertificateSecondaryLogo: vi.fn(),
  uploadCourseCertificateSignature: vi.fn(),
}));

const toast = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

const authState = vi.hoisted(() => ({
  user: { id: 7, role: 'company_admin', fullName: 'EduPro Admin', email: 'admin@test.dev' },
}));

const tenantState = vi.hoisted(() => ({
  activeTenant: {
    id: 42,
    name: 'EduPro',
    role: 'company_admin',
    permissions: {
      canManageCertificates: true,
      canApproveAssignedCertificates: false,
    },
  } as {
    id: number;
    name: string;
    role: string;
    permissions: Record<string, boolean>;
  },
}));

vi.mock('react-hot-toast', () => ({
  default: toast,
}));

vi.mock('../../services/api', () => api);

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    user: authState.user,
  }),
}));

vi.mock('../tenant/TenantProvider', () => ({
  useTenant: () => ({
    activeTenant: tenantState.activeTenant,
  }),
}));

const branding = {
  companyId: 42,
  primaryBrandName: 'EduPro',
  primaryColor: '#122144',
  accentColor: '#f17e22',
  certificateTitle: 'Certificate of Completion',
  issuerDisplayName: 'EduPro',
  issuerTitle: 'Instructor',
};

const course = {
  id: 101,
  title: 'Live Math',
  courseType: 'offline',
  status: 'approved',
  isPublished: true,
  instructor: { id: 7, fullName: 'EduPro Instructor' },
};

const unassignedCourse = {
  id: 102,
  title: 'Unassigned Course',
  courseType: 'offline',
  status: 'approved',
  isPublished: true,
  instructor: { id: 99, fullName: 'Other Instructor' },
};

const settings = {
  courseId: 101,
  enabled: true,
  issueMode: 'manual',
  approvalMode: 'instructor',
  eligibilityAttendanceRequired: true,
  eligibilityAttendancePercent: 80,
  eligibilityHomeworkRequired: false,
  eligibilityHomeworkPercent: 100,
  eligibilityActivitiesRequired: false,
  eligibilityActivitiesPercent: 100,
};

function renderPage(initialEntry = '/certificates?tab=registry&courseId=101') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <CertificatesPage />
    </MemoryRouter>,
  );
}

describe('CertificatesPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    vi.clearAllMocks();
    authState.user = { id: 7, role: 'company_admin', fullName: 'EduPro Admin', email: 'admin@test.dev' };
    tenantState.activeTenant = {
      id: 42,
      name: 'EduPro',
      role: 'company_admin',
      permissions: {
        canManageCertificates: true,
        canApproveAssignedCertificates: false,
      },
    };
    api.getCertificateBranding.mockResolvedValue(branding);
    api.listTenantCourses.mockResolvedValue([course]);
    api.getCourseCertificateSettings.mockResolvedValue(settings);
    api.listCourseCertificates.mockResolvedValue([]);
    api.previewCourseCertificate.mockResolvedValue('<main>Certificate preview</main>');
    api.listCourseGroups.mockResolvedValue([]);
    api.listCourseStudents.mockResolvedValue({
      students: [],
      page: 1,
      limit: 100,
      total: 0,
      totalPages: 1,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('loads every roster page for owner and company admin certificate registries', async () => {
    api.listCourseStudents
      .mockResolvedValueOnce({
        students: [{ id: 1, userId: 201, fullName: 'Aida Student', email: 'aida@test.dev', certificateEligible: true }],
        page: 1,
        limit: 100,
        total: 2,
        totalPages: 2,
      })
      .mockResolvedValueOnce({
        students: [{ id: 2, userId: 202, fullName: 'Ben Student', email: 'ben@test.dev', certificateEligible: false }],
        page: 2,
        limit: 100,
        total: 2,
        totalPages: 2,
      });

    renderPage();

    expect(await screen.findByText('Aida Student')).toBeInTheDocument();
    expect(screen.getByText('Ben Student')).toBeInTheDocument();
    expect(api.listCourseStudents).toHaveBeenNthCalledWith(1, 101, { page: 1, limit: 100 });
    expect(api.listCourseStudents).toHaveBeenNthCalledWith(2, 101, { page: 2, limit: 100 });
  });

  it('shows an instructor approval inbox scoped to directly owned and assigned courses without loading the admin roster', async () => {
    authState.user = { id: 7, role: 'instructor', fullName: 'EduPro Instructor', email: 'teacher@test.dev' };
    tenantState.activeTenant = {
      id: 42,
      name: 'EduPro',
      role: 'instructor',
      permissions: {
        canManageCertificates: false,
        canApproveAssignedCertificates: true,
      },
    };
    api.listTenantCourses.mockResolvedValue([course, unassignedCourse]);
    api.listCourseGroups.mockImplementation((courseId: number) => Promise.resolve(
      courseId === 101
        ? []
        : [{ id: 302, name: 'Group B', courseId: 102, instructorId: 99 }],
    ));
    api.listCourseCertificates.mockResolvedValue([{
      id: 501,
      publicId: 'CERT-501',
      studentId: 201,
      studentName: 'Aida Student',
      courseId: 101,
      status: 'pending_approval',
      requestedAt: '2026-05-22T10:00:00.000Z',
    }]);

    renderPage('/certificates?tab=registry&courseId=101');

    expect(await screen.findByText('Certificate approvals')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pending approvals' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Live Math' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Unassigned Course' })).not.toBeInTheDocument();
    expect(await screen.findByText('Aida Student')).toBeInTheDocument();
    expect(api.listCourseGroups).not.toHaveBeenCalledWith(101);
    expect(api.listCourseGroups).toHaveBeenCalledWith(102);
    await new Promise((resolve) => window.setTimeout(resolve, 350));
    expect(api.listCourseStudents).not.toHaveBeenCalled();
  });
});
