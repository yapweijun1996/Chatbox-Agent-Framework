/**
 * GPU Performance Monitor
 * 用于监控和报告 GPU 使用率、FPS 等性能指标
 * 
 * 使用方法：
 * 在 demo/main.ts 中导入并调用：
 * import { initPerformanceMonitor } from './utils/performance-monitor';
 * initPerformanceMonitor();
 */

interface PerformanceStats {
    fps: number;
    gpuUtilization?: number;
    memoryUsage: number;
    timestamp: number;
}

class PerformanceMonitor {
    private fps = 0;
    private frames = 0;
    private lastTime = performance.now();
    private stats: PerformanceStats[] = [];
    private maxStats = 100; // 保留最近 100 个数据点
    private monitorElement: HTMLDivElement | null = null;
    private rafId: number | null = null;

    constructor() {
        this.createMonitorUI();
        this.startMonitoring();
    }

    private createMonitorUI(): void {
        // 创建性能监控面板
        this.monitorElement = document.createElement('div');
        this.monitorElement.id = 'perf-monitor';
        this.monitorElement.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(10, 14, 20, 0.95);
      border: 1px solid rgba(148, 163, 184, 0.3);
      border-radius: 12px;
      padding: 12px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: #d5dbe5;
      z-index: 10000;
      min-width: 200px;
      backdrop-filter: blur(10px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    `;
        document.body.appendChild(this.monitorElement);
    }

    private startMonitoring(): void {
        const measure = () => {
            this.frames++;
            const now = performance.now();

            // 每秒更新一次 FPS
            if (now >= this.lastTime + 1000) {
                this.fps = Math.round((this.frames * 1000) / (now - this.lastTime));
                this.frames = 0;
                this.lastTime = now;

                // 收集性能数据
                this.collectStats();
                this.updateUI();
            }

            this.rafId = requestAnimationFrame(measure);
        };

        this.rafId = requestAnimationFrame(measure);
    }

    private collectStats(): void {
        const stats: PerformanceStats = {
            fps: this.fps,
            memoryUsage: this.getMemoryUsage(),
            timestamp: Date.now(),
        };

        this.stats.push(stats);
        if (this.stats.length > this.maxStats) {
            this.stats.shift();
        }
    }

    private getMemoryUsage(): number {
        // @ts-ignore - performance.memory is Chrome-specific
        if (performance.memory) {
            // @ts-ignore
            return Math.round(performance.memory.usedJSHeapSize / 1048576); // MB
        }
        return 0;
    }

    private updateUI(): void {
        if (!this.monitorElement) return;

        const avgFps = this.calculateAvgFPS();
        const fpsColor = this.fps >= 55 ? '#22c55e' : this.fps >= 30 ? '#f59e0b' : '#ef4444';

        this.monitorElement.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(148, 163, 184, 0.2); padding-bottom: 6px;">
          <span style="color: #9aa3b2; text-transform: uppercase; letter-spacing: 0.05em; font-size: 10px;">性能监控</span>
          <button id="perf-toggle" style="background: transparent; border: 1px solid rgba(148, 163, 184, 0.3); color: #9aa3b2; padding: 2px 8px; border-radius: 6px; cursor: pointer; font-size: 10px;">最小化</button>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>FPS:</span>
          <span style="color: ${fpsColor}; font-weight: 600;">${this.fps}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>平均 FPS:</span>
          <span style="color: #2dd4bf;">${avgFps}</span>
        </div>
        ${this.getMemoryUsage() > 0 ? `
        <div style="display: flex; justify-content: space-between;">
          <span>内存:</span>
          <span style="color: #38bdf8;">${this.getMemoryUsage()} MB</span>
        </div>
        ` : ''}
        <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(148, 163, 184, 0.2); font-size: 10px; color: #9aa3b2;">
          <div>💡 提示: 观察 GPU 使用率</div>
          <div style="margin-top: 4px;">打开 Activity Monitor (活动监视器)</div>
          <div>查看 GPU 占用百分比</div>
        </div>
      </div>
    `;

        // 添加最小化功能
        const toggleBtn = document.getElementById('perf-toggle');
        if (toggleBtn) {
            toggleBtn.onclick = () => this.toggleMinimize();
        }
    }

    private calculateAvgFPS(): number {
        if (this.stats.length === 0) return 0;
        const sum = this.stats.reduce((acc, stat) => acc + stat.fps, 0);
        return Math.round(sum / this.stats.length);
    }

    private toggleMinimize(): void {
        if (!this.monitorElement) return;

        const isMinimized = this.monitorElement.style.width === '50px';

        if (isMinimized) {
            this.monitorElement.style.width = '';
            this.monitorElement.style.height = '';
            this.updateUI();
        } else {
            this.monitorElement.style.width = '50px';
            this.monitorElement.style.height = '50px';
            this.monitorElement.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%; cursor: pointer; font-size: 20px;" id="perf-expand">
          📊
        </div>
      `;
            const expandBtn = document.getElementById('perf-expand');
            if (expandBtn) {
                expandBtn.onclick = () => this.toggleMinimize();
            }
        }
    }

    // 获取性能统计
    public getStats(): PerformanceStats[] {
        return [...this.stats];
    }

    // 导出性能报告
    public exportReport(): string {
        const avgFps = this.calculateAvgFPS();
        const maxFps = Math.max(...this.stats.map(s => s.fps));
        const minFps = Math.min(...this.stats.map(s => s.fps));
        const avgMemory = this.stats.length > 0
            ? Math.round(this.stats.reduce((acc, s) => acc + s.memoryUsage, 0) / this.stats.length)
            : 0;

        return `
性能报告 - ${new Date().toLocaleString()}
========================================
FPS 统计:
  - 平均: ${avgFps}
  - 最高: ${maxFps}
  - 最低: ${minFps}

内存使用:
  - 平均: ${avgMemory} MB

数据点: ${this.stats.length}
监控时长: ${Math.round(this.stats.length / 60)} 分钟
    `.trim();
    }

    // 停止监控
    public destroy(): void {
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
        }
        if (this.monitorElement) {
            this.monitorElement.remove();
        }
    }
}

// 全局实例
let monitorInstance: PerformanceMonitor | null = null;

/**
 * 初始化性能监控器
 */
export function initPerformanceMonitor(): PerformanceMonitor {
    if (!monitorInstance) {
        monitorInstance = new PerformanceMonitor();
    }
    return monitorInstance;
}

/**
 * 获取性能监控器实例
 */
export function getPerformanceMonitor(): PerformanceMonitor | null {
    return monitorInstance;
}

/**
 * 销毁性能监控器
 */
export function destroyPerformanceMonitor(): void {
    if (monitorInstance) {
        monitorInstance.destroy();
        monitorInstance = null;
    }
}

// 添加到全局 window 对象以便在控制台使用
if (typeof window !== 'undefined') {
    (window as any).perfMonitor = {
        init: initPerformanceMonitor,
        get: getPerformanceMonitor,
        destroy: destroyPerformanceMonitor,
        exportReport: () => {
            const monitor = getPerformanceMonitor();
            if (monitor) {
                console.log(monitor.exportReport());
            }
        }
    };
}
