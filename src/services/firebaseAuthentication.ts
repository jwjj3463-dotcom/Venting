import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { initializeApp } from 'firebase/app';
import firebaseServices from '../../google-services.json';

const projectInfo = firebaseServices.project_info;
const androidClient = firebaseServices.client.find(
  (client) => client.client_info.android_client_info.package_name === 'com.fadfadahnative'
);

if (!androidClient) {
  throw new Error('إعداد Firebase لا يحتوي تطبيق Android بالمعرّف الصحيح.');
}

if (Capacitor.getPlatform() === 'web') {
  initializeApp({
    apiKey: androidClient.api_key[0].current_key,
    authDomain: `${projectInfo.project_id}.firebaseapp.com`,
    projectId: projectInfo.project_id,
    storageBucket: projectInfo.storage_bucket,
    messagingSenderId: projectInfo.project_number,
    appId: '1:1052135859886:web:8de6e05f9cf583825fef3f',
  });
}

export function getFirebaseAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : '';
  const messages: Record<string, string> = {
    'auth/email-already-in-use': 'هذا البريد مسجل بالفعل. سجّل الدخول بدل إنشاء حساب جديد.',
    'auth/invalid-email': 'صيغة البريد الإلكتروني غير صحيحة.',
    'auth/invalid-credential': 'البريد أو كلمة المرور غير صحيحة.',
    'auth/weak-password': 'اختر كلمة مرور لا تقل عن 6 أحرف.',
    'auth/too-many-requests': 'محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة.',
    'auth/network-request-failed': 'تعذر الاتصال بخدمة تسجيل الدخول. تحقق من اتصال الإنترنت.',
    'auth/popup-closed-by-user': 'أُغلق تسجيل الدخول قبل اكتماله.',
    'auth/account-exists-with-different-credential':
      'هذا البريد مرتبط بطريقة دخول أخرى. استخدم طريقة الدخول الأصلية.',
  };
  if (messages[code]) return messages[code];
  return error instanceof Error ? error.message : 'تعذر إكمال تسجيل الدخول.';
}

export async function signInWithGoogleAndGetIdToken(): Promise<string> {
  await signInWithGoogle();
  return getVerifiedEmailIdToken();
}

export async function signInWithEmailAndGetIdToken(
  email: string,
  password: string
): Promise<string> {
  await FirebaseAuthentication.signInWithEmailAndPassword({
    email: email.trim(),
    password,
  });
  return getVerifiedEmailIdToken();
}

export async function createEmailAccount(email: string, password: string): Promise<void> {
  await FirebaseAuthentication.createUserWithEmailAndPassword({
    email: email.trim(),
    password,
  });
  await FirebaseAuthentication.sendEmailVerification();
}

export async function resendEmailVerification(): Promise<void> {
  await FirebaseAuthentication.sendEmailVerification();
}

export async function completeEmailVerification(): Promise<string> {
  await FirebaseAuthentication.reload();
  return getVerifiedEmailIdToken();
}

export async function sendPasswordReset(email: string): Promise<void> {
  await FirebaseAuthentication.sendPasswordResetEmail({ email: email.trim() });
}

export async function createOrLinkEmailAccount(
  email: string,
  password: string
): Promise<boolean> {
  const { user } = await FirebaseAuthentication.getCurrentUser();
  if (user) {
    await FirebaseAuthentication.linkWithEmailAndPassword({
      email: email.trim(),
      password,
    });
  } else {
    try {
      await FirebaseAuthentication.createUserWithEmailAndPassword({
        email: email.trim(),
        password,
      });
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String(error.code)
          : '';
      if (code !== 'auth/email-already-in-use') throw error;
      await FirebaseAuthentication.signInWithEmailAndPassword({
        email: email.trim(),
        password,
      });
    }
  }
  const { user: linkedUser } = await FirebaseAuthentication.getCurrentUser();
  if (linkedUser?.emailVerified) return true;
  await FirebaseAuthentication.sendEmailVerification();
  return false;
}

export async function signInGoogleForLinking(): Promise<string> {
  const { user } = await FirebaseAuthentication.getCurrentUser();
  if (user) {
    await FirebaseAuthentication.linkWithGoogle();
  } else {
    await signInWithGoogle();
  }
  return getVerifiedEmailIdToken();
}

export async function completeEmailLinkVerification(): Promise<string> {
  await FirebaseAuthentication.reload();
  return getVerifiedEmailIdToken();
}

async function getVerifiedEmailIdToken(): Promise<string> {
  const { user } = await FirebaseAuthentication.getCurrentUser();
  if (!user?.emailVerified) {
    throw new Error('تحقق من بريدك الإلكتروني أولًا، ثم اضغط متابعة.');
  }

  return getFirebaseIdToken();
}

async function getFirebaseIdToken(): Promise<string> {
  const { token } = await FirebaseAuthentication.getIdToken({ forceRefresh: true });
  if (!token) throw new Error('لم يتمكن Firebase من إصدار رمز دخول صالح.');
  return token;
}

async function signInWithGoogle(): Promise<void> {
  try {
    await FirebaseAuthentication.signInWithGoogle({ useCredentialManager: true });
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String(error.code)
        : '';
    const message = error instanceof Error ? error.message : String(error);
    if (code !== '16' && !/\[16\]\s*Account reauth failed/i.test(message)) {
      throw error;
    }

    await FirebaseAuthentication.signInWithGoogle({ useCredentialManager: false });
  }
}
