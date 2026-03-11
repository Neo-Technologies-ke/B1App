#!/usr/bin/env node

/**
 * Post-install patch script for @churchapps/apphelper
 * Replaces B1.Church and Lessons.church labels with Portal and Lessons
 * Updates URLs to point to lifereformationcentre.org subdomains
 */

const fs = require('fs');
const path = require('path');

const APPHELPER_PATH = path.join(__dirname, '../node_modules/@churchapps/apphelper/src/components/wrapper/AppList.tsx');

console.log('🔧 Patching @churchapps/apphelper...');

try {
  // Check if file exists
  if (!fs.existsSync(APPHELPER_PATH)) {
    console.log('⚠️  AppList.tsx not found, skipping patch');
    process.exit(0);
  }

  // Read the file
  let content = fs.readFileSync(APPHELPER_PATH, 'utf8');

  // Original content to replace
  const originalB1Line = '<NavItem url={`${CommonEnvironmentHelper.B1Root.replace("{key}", props.currentUserChurch.church.subDomain)}/login?jwt=${jwt}&churchId=${churchId}`} selected={props.appName === "B1.church"} external={true} label="B1.Church" icon="logout" onNavigate={props.onNavigate} />';
  const originalLessonsLine = '<NavItem url={`${CommonEnvironmentHelper.LessonsRoot}/login?jwt=${jwt}&churchId=${churchId}`} selected={props.appName === "Lessons.church"} external={true} label="Lessons.church" icon="logout" onNavigate={props.onNavigate} />';

  // New content
  const patchedB1Line = '<NavItem url={`https://portal.lifereformationcentre.org/login?jwt=${jwt}&churchId=${churchId}`} selected={props.appName === "Portal"} external={true} label="Portal" icon="logout" onNavigate={props.onNavigate} />';
  const patchedLessonsLine = '<NavItem url={`https://lessons.lifereformationcentre.org/login?jwt=${jwt}&churchId=${churchId}`} selected={props.appName === "Lessons"} external={true} label="Lessons" icon="logout" onNavigate={props.onNavigate} />';

  // Check if already patched
  if (content.includes('portal.lifereformationcentre.org') && content.includes('lessons.lifereformationcentre.org')) {
    console.log('✅ AppList.tsx already patched');
    process.exit(0);
  }

  // Apply patches
  let patched = false;
  if (content.includes(originalB1Line)) {
    content = content.replace(originalB1Line, patchedB1Line);
    patched = true;
  }
  if (content.includes(originalLessonsLine)) {
    content = content.replace(originalLessonsLine, patchedLessonsLine);
    patched = true;
  }

  if (patched) {
    // Write the patched content back
    fs.writeFileSync(APPHELPER_PATH, content, 'utf8');
    console.log('✅ Successfully patched AppList.tsx');
    console.log('   - B1.Church → Portal (portal.lifereformationcentre.org)');
    console.log('   - Lessons.church → Lessons (lessons.lifereformationcentre.org)');
  } else {
    console.log('⚠️  Could not find expected content to patch');
  }

} catch (error) {
  console.error('❌ Error patching AppList.tsx:', error.message);
  // Don't fail the install if patching fails
  process.exit(0);
}
