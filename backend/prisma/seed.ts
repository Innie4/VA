import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create roles
  const userRole = await prisma.role.upsert({
    where: { name: 'user' },
    update: {},
    create: {
      name: 'user',
      description: 'Standard user role',
      permissions: 'read:own_profile,update:own_profile,create:conversation,upload:file',
    },
  });

  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: {
      name: 'admin',
      description: 'Administrator role',
      permissions: 'read:own_profile,update:own_profile,create:conversation,upload:file,read:all_users,update:all_users,delete:users,manage:system_settings,view:analytics',
    },
  });

  const superAdminRole = await prisma.role.upsert({
    where: { name: 'super_admin' },
    update: {},
    create: {
      name: 'super_admin',
      description: 'Super administrator role',
      permissions: 'read:own_profile,update:own_profile,create:conversation,upload:file,read:all_users,update:all_users,delete:users,manage:system_settings,view:analytics,manage:roles,manage:permissions,access:system_logs',
    },
  });

  console.log('✅ Roles created successfully');

  // Create default admin user
  const hashedPassword = await bcrypt.hash('admin123!', 12);
  
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@ai-chat.com' },
    update: {},
    create: {
      email: 'admin@ai-chat.com',
      password: hashedPassword,
      firstName: 'System',
      lastName: 'Administrator',
      bio: 'Default system administrator account',
      isActive: true,
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
      tier: 'premium',
      roleId: superAdminRole.id,
      lastActiveAt: new Date(),
    },
  });

  // Create user preferences for admin
  await prisma.userPreferences.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: {
      userId: adminUser.id,
      theme: 'dark',
      language: 'en',
      timezone: 'UTC',
      emailNotifications: true,
      pushNotifications: true,
      smsNotifications: false,
      autoSave: true,
      showTypingIndicator: true,
      soundEnabled: true,
      defaultModel: 'gpt-4',
      defaultTemperature: 0.7,
      defaultMaxTokens: 2048,
    },
  });

  // User statistics removed - not in current schema

  console.log('✅ Admin user created successfully');

  // Create demo user
  const demoHashedPassword = await bcrypt.hash('demo123!', 12);
  
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@ai-chat.com' },
    update: {},
    create: {
      email: 'demo@ai-chat.com',
      password: demoHashedPassword,
      firstName: 'Demo',
      lastName: 'User',
      bio: 'Demo user account for testing',
      isActive: true,
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
      tier: 'basic',
      roleId: userRole.id,
      lastActiveAt: new Date(),
    },
  });

  // Create user preferences for demo user
  await prisma.userPreferences.upsert({
    where: { userId: demoUser.id },
    update: {},
    create: {
      userId: demoUser.id,
      theme: 'light',
      language: 'en',
      timezone: 'UTC',
      emailNotifications: true,
      pushNotifications: true,
      smsNotifications: false,
      autoSave: true,
      showTypingIndicator: true,
      soundEnabled: true,
      defaultModel: 'gpt-4',
      defaultTemperature: 0.7,
      defaultMaxTokens: 1024,
    },
  });

  // User statistics removed - not in current schema

  console.log('✅ Demo user created successfully');

  // Create system settings
  const systemSettings = [
    {
      key: 'app_name',
      value: 'AI Chat Application',
      description: 'Application name displayed in the UI',
      isPublic: true,
    },
    {
      key: 'app_version',
      value: '1.0.0',
      description: 'Current application version',
      isPublic: true,
    },
    {
      key: 'maintenance_mode',
      value: 'false',
      description: 'Enable/disable maintenance mode',
      isPublic: false,
    },
    {
      key: 'registration_enabled',
      value: 'true',
      description: 'Allow new user registrations',
      isPublic: false,
    },
    {
      key: 'max_file_size',
      value: '10485760',
      description: 'Maximum file upload size in bytes (10MB)',
      isPublic: false,
    },
    {
      key: 'max_message_length',
      value: '4000',
      description: 'Maximum message length in characters',
      isPublic: false,
    },
    {
      key: 'ai_model_default',
      value: 'gpt-4',
      description: 'Default AI model for new users',
      isPublic: false,
    },
    {
      key: 'rate_limit_messages',
      value: '30',
      description: 'Rate limit for messages per minute',
      isPublic: false,
    },
  ];

  for (const setting of systemSettings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
  }

  console.log('✅ System settings created successfully');

  // Create basic feature flags
  await prisma.featureFlag.upsert({
    where: { name: 'voice_input' },
    update: {},
    create: {
      name: 'voice_input',
      description: 'Enable voice input functionality',
      isEnabled: true,
      rules: JSON.stringify({ userTiers: ['basic', 'pro', 'premium'] }),
    },
  });

  await prisma.featureFlag.upsert({
    where: { name: 'file_upload' },
    update: {},
    create: {
      name: 'file_upload',
      description: 'Enable file upload functionality',
      isEnabled: true,
      rules: JSON.stringify({ userTiers: ['basic', 'pro', 'premium'] }),
    },
  });

  console.log('✅ Feature flags created successfully');

  // Create a sample conversation for demo user
  const conversation = await prisma.conversation.create({
    data: {
      title: 'Welcome to AI Chat',
      description: 'Your first conversation with the AI assistant',
      userId: demoUser.id,
    },
  });

  // Create sample messages
  await prisma.message.createMany({
    data: [
      {
        conversationId: conversation.id,
        userId: demoUser.id,
        content: 'Hello! I\'m excited to try out this AI chat application.',
        role: 'user',
        type: 'text',
      },
      {
        conversationId: conversation.id,
        userId: demoUser.id,
        content: 'Hello! Welcome to the AI Chat application. I\'m here to help you with any questions or tasks you might have. Feel free to ask me anything!',
        role: 'assistant',
        type: 'text',
      },
      {
        conversationId: conversation.id,
        userId: demoUser.id,
        content: 'What can you help me with?',
        role: 'user',
        type: 'text',
      },
      {
        conversationId: conversation.id,
        userId: demoUser.id,
        content: 'I can help you with a wide variety of tasks including:\n\n• Answering questions on various topics\n• Writing and editing text\n• Coding and programming assistance\n• Creative writing and brainstorming\n• Analysis and problem-solving\n• And much more!\n\nWhat would you like to explore today?',
        role: 'assistant',
        type: 'text',
      },
    ],
  });

  console.log('✅ Sample conversation created successfully');

  console.log('🎉 Database seeding completed successfully!');
  console.log('\n📋 Created accounts:');
  console.log('👤 Admin: admin@ai-chat.com / admin123!');
  console.log('👤 Demo: demo@ai-chat.com / demo123!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });