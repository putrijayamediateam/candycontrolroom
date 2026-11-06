import { defineConfig, configDefaults } from 'vitest/config';
// .claude/worktrees holds other Claude sessions' copies of the repo; never run their tests here.
export default defineConfig({ test: { fileParallelism: false, testTimeout: 20000, exclude: [...configDefaults.exclude, '.claude/**'] } });
