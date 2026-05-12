import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import * as jwt from 'jsonwebtoken';
import { SignOptions } from 'jsonwebtoken';
import prisma from '../utils/prisma';
import { generateApiKey } from '../utils/generateApiKey';

// JWT token signing function
function signToken(userId: string): string {
  const jwtSecret = process.env.JWT_SECRET || 'test-secret';
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign({ userId }, jwtSecret, { expiresIn } as SignOptions);
}

/**
 * Configure Google OAuth Strategy
 */
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackURL: process.env.GOOGLE_REDIRECT_URI || `${process.env.API_BASE_URL || 'http://localhost:3000'}/api/auth/google/callback`,
    },
    async (accessToken: string, refreshToken: string, profile: any, done: (error: any, user?: any) => void) => {
      try {
        if (!profile.emails || !profile.emails[0] || !profile.emails[0].value) {
          return done(new Error('No email found in Google profile'), null);
        }

        const email = profile.emails[0].value;
        const googleId = profile.id;
        const displayName = profile.displayName || '';
        const usernameBase = email.split('@')[0];
        
        // Parse first and last name from displayName
        const nameParts = displayName.trim().split(' ');
        const firstName = nameParts[0] || null;
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;

        // Find existing user by email or googleId
        let user = await prisma.user.findFirst({
          where: {
            OR: [{ email }, { googleId }],
          },
          select: {
            id: true,
            username: true,
            email: true,
            phone: true,
            firstName: true,
            lastName: true,
            apiKey: true,
            devApiKey: true,
            plan: true,
            role: true,
            country: true,
            profileComplete: true,
            createdAt: true,
          },
        });

        let isNewUser = false;

        if (!user) {
          isNewUser = true;
          // Ensure unique username
          let username = usernameBase;
          if (username && username.length < 3) {
            username = `${username}user`;
          }
          let suffix = 1;
          while (username && (await prisma.user.findUnique({ where: { username } }))) {
            username = `${usernameBase}${suffix}`;
            suffix += 1;
          }

          // Generate API keys
          let apiKey = generateApiKey();
          let devApiKey = generateApiKey();
          let keyExists = await prisma.user.findUnique({ where: { apiKey } });
          let devKeyExists = await prisma.user.findUnique({ where: { devApiKey } });
          while (keyExists) {
            apiKey = generateApiKey();
            keyExists = await prisma.user.findUnique({ where: { apiKey } });
          }
          while (devKeyExists) {
            devApiKey = generateApiKey();
            devKeyExists = await prisma.user.findUnique({ where: { devApiKey } });
          }

          user = await prisma.user.create({
            data: {
              username: username || null,
              email,
              googleId,
              password: null,
              firstName,
              lastName,
              apiKey,
              devApiKey,
              plan: 'FREE',
              role: 'USER',
              profileComplete: false, // Needs to complete profile (select country)
            },
            select: {
              id: true,
              username: true,
              email: true,
              phone: true,
              firstName: true,
              lastName: true,
              apiKey: true,
              devApiKey: true,
              plan: true,
              role: true,
              country: true,
              profileComplete: true,
              createdAt: true,
            },
          });

          // Assign free package to new user (async, don't block auth flow)
          if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
            const { assignFreePackageToUser } = await import('../utils/tokenUsage');
            assignFreePackageToUser(user.id).catch((error) => {
              // Log error but don't fail auth if package assignment fails
              console.error('Failed to assign free package to user:', error);
            });
          }
        } else if (!user.email && email) {
          // Update user if they logged in with Google but had no email
          user = await prisma.user.update({
            where: { id: user.id },
            data: { email, googleId: googleId || user.id },
            select: {
              id: true,
              username: true,
              email: true,
              phone: true,
              firstName: true,
              lastName: true,
              apiKey: true,
              devApiKey: true,
              plan: true,
              role: true,
              country: true,
              profileComplete: true,
              createdAt: true,
            },
          });
        }

        // Generate JWT token
        const token = signToken(user.id);
        
        return done(null, { user, token, isNewUser });
      } catch (error: any) {
        return done(error, null);
      }
    }
  )
);

/**
 * Serialize user for session (not used with JWT, but required by Passport)
 */
passport.serializeUser((user: any, done: (err: any, id?: any) => void) => {
  done(null, user);
});

passport.deserializeUser((user: any, done: (err: any, user?: any) => void) => {
  done(null, user);
});

export default passport;

