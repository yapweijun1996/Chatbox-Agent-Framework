#!/usr/bin/env node

/**
 * NPM 发布前检查脚本
 * 确保所有必要条件都已满足
 */

import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// 颜色输出
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
};

function log(message, color = 'reset') {
    console.log(colors[color] + message + colors.reset);
}

function success(message) {
    log('✓ ' + message, 'green');
}

function error(message) {
    log('✗ ' + message, 'red');
}

function warning(message) {
    log('⚠ ' + message, 'yellow');
}

function info(message) {
    log('ℹ ' + message, 'blue');
}

// 检查项
const checks = [
    {
        name: '检查必要文件',
        check: () => {
            const requiredFiles = [
                'package.json',
                'README.md',
                'LICENSE',
                'CHANGELOG.md',
                'tsconfig.json',
                'tsconfig.build.json',
            ];

            const missing = requiredFiles.filter(file => !existsSync(join(rootDir, file)));

            if (missing.length > 0) {
                error(`缺少文件: ${missing.join(', ')}`);
                return false;
            }

            success('所有必要文件存在');
            return true;
        },
    },
    {
        name: '检查 package.json 配置',
        check: () => {
            const pkgPath = join(rootDir, 'package.json');
            const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

            const requiredFields = ['name', 'version', 'description', 'main', 'types', 'license'];
            const missing = requiredFields.filter(field => !pkg[field]);

            if (missing.length > 0) {
                error(`package.json 缺少字段: ${missing.join(', ')}`);
                return false;
            }

            if (!pkg.files || pkg.files.length === 0) {
                warning('package.json 未指定 files 字段');
            }

            if (!pkg.keywords || pkg.keywords.length === 0) {
                warning('package.json 未指定 keywords');
            }

            success('package.json 配置正确');
            return true;
        },
    },
    {
        name: '检查构建输出',
        check: () => {
            const distDir = join(rootDir, 'dist');

            if (!existsSync(distDir)) {
                error('dist 目录不存在，请先运行 npm run build:lib');
                return false;
            }

            const requiredFiles = ['index.js', 'index.d.ts'];
            const missing = requiredFiles.filter(file => !existsSync(join(distDir, file)));

            if (missing.length > 0) {
                error(`dist 目录缺少文件: ${missing.join(', ')}`);
                return false;
            }

            success('构建输出正确');
            return true;
        },
    },
    {
        name: '检查版本号格式',
        check: () => {
            const pkgPath = join(rootDir, 'package.json');
            const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

            const versionRegex = /^\d+\.\d+\.\d+(-[a-z0-9.]+)?$/;
            if (!versionRegex.test(pkg.version)) {
                error(`版本号格式不正确: ${pkg.version}`);
                return false;
            }

            success(`版本号正确: ${pkg.version}`);
            return true;
        },
    },
    {
        name: '检查 Git 状态',
        check: async () => {
            try {
                const { execSync } = await import('child_process');

                // 检查是否有未提交的变更
                const status = execSync('git status --porcelain', {
                    cwd: rootDir,
                    encoding: 'utf-8'
                });

                if (status.trim()) {
                    warning('Git 工作区有未提交的变更');
                    info('建议在发布前提交所有变更');
                } else {
                    success('Git 工作区干净');
                }

                return true;
            } catch (err) {
                warning('无法检查 Git 状态（可能不在 Git 仓库中）');
                return true;
            }
        },
    },
];

// 执行检查
async function runChecks() {
    log('\n📦 NPM 发布前检查\n', 'blue');

    let passed = 0;
    let failed = 0;

    for (const check of checks) {
        info(`\n${check.name}...`);
        try {
            const result = await check.check();
            if (result) {
                passed++;
            } else {
                failed++;
            }
        } catch (err) {
            error(`检查失败: ${err.message}`);
            failed++;
        }
    }

    log('\n' + '='.repeat(50), 'blue');
    log(`\n总计: ${passed + failed} 项检查`, 'blue');
    success(`通过: ${passed} 项`);
    if (failed > 0) {
        error(`失败: ${failed} 项`);
    }

    if (failed === 0) {
        log('\n✅ 所有检查通过！可以发布。', 'green');
        log('\n发布步骤:', 'blue');
        info('1. npm run test:run  # 运行测试');
        info('2. npm run build:lib # 构建库');
        info('3. npm publish        # 发布到 NPM');
        return 0;
    } else {
        log('\n❌ 部分检查未通过，请修复后再发布。', 'red');
        return 1;
    }
}

// 运行
runChecks()
    .then(code => process.exit(code))
    .catch(err => {
        error(`发生错误: ${err.message}`);
        process.exit(1);
    });
