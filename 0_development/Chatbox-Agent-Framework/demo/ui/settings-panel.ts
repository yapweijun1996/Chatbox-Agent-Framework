import type { LLMSettings, LLMProvider } from '../settings';
import { getModelHistory, saveModelHistory } from '../state';

type SaveHandler = (settings: LLMSettings) => void;

export class SettingsPanel {
    private tempSettings?: LLMSettings;
    private selectedProvider: LLMProvider = 'lm-studio';

    constructor(
        private readonly modal: HTMLElement,
        providerButtons: NodeListOf<Element>,
        private readonly onSave?: SaveHandler,
    ) {
        providerButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const provider = btn.getAttribute('data-provider') as LLMProvider;
                this.selectedProvider = provider || 'lm-studio';
                this.updateProviderSelection(providerButtons);
            });
        });
    }

    open(settings: LLMSettings): void {
        this.tempSettings = JSON.parse(JSON.stringify(settings));
        this.selectedProvider = settings.provider;
        this.populateForm();
        this.updateProviderSelection();
        this.updateModelDatalist();
        this.modal.classList.remove('hidden');
    }

    close(): void {
        this.modal.classList.add('hidden');
    }

    save(): void {
        if (!this.tempSettings) return;

        this.tempSettings.provider = this.selectedProvider;
        this.tempSettings.lmStudio.baseURL = (document.getElementById('lm-studio-url') as HTMLInputElement).value || 'http://127.0.0.1:6354';
        this.tempSettings.lmStudio.model = (document.getElementById('lm-studio-model') as HTMLInputElement).value || 'mistralai/ministral-3-14b-reasoning';

        if (this.tempSettings.lmStudio.model) {
            saveModelHistory(this.tempSettings.lmStudio.model);
        }

        this.tempSettings.gemini.apiKey = (document.getElementById('gemini-api-key') as HTMLInputElement).value;
        this.tempSettings.gemini.model = (document.getElementById('gemini-model') as HTMLSelectElement).value;
        this.tempSettings.openai.apiKey = (document.getElementById('openai-api-key') as HTMLInputElement).value;
        this.tempSettings.openai.baseURL = (document.getElementById('openai-base-url') as HTMLInputElement).value || 'https://api.openai.com';
        this.tempSettings.openai.model = (document.getElementById('openai-model') as HTMLSelectElement).value;

        if (this.selectedProvider === 'gemini' && !this.tempSettings.gemini.apiKey) {
            alert('Please enter your Gemini API key');
            return;
        }
        if (this.selectedProvider === 'openai' && !this.tempSettings.openai.apiKey) {
            alert('Please enter your OpenAI API key');
            return;
        }

        this.onSave?.(this.tempSettings);
        this.close();
    }

    private populateForm(): void {
        if (!this.tempSettings) return;
        (document.getElementById('lm-studio-url') as HTMLInputElement).value = this.tempSettings.lmStudio.baseURL;
        (document.getElementById('lm-studio-model') as HTMLInputElement).value = this.tempSettings.lmStudio.model;
        (document.getElementById('gemini-api-key') as HTMLInputElement).value = this.tempSettings.gemini.apiKey;
        (document.getElementById('gemini-model') as HTMLSelectElement).value = this.tempSettings.gemini.model;
        (document.getElementById('openai-api-key') as HTMLInputElement).value = this.tempSettings.openai.apiKey;
        (document.getElementById('openai-base-url') as HTMLInputElement).value = this.tempSettings.openai.baseURL;
        (document.getElementById('openai-model') as HTMLSelectElement).value = this.tempSettings.openai.model;
    }

    private updateProviderSelection(providerButtons?: NodeListOf<Element>): void {
        const buttons = providerButtons || document.querySelectorAll('.provider-btn');
        buttons.forEach(btn => {
            const provider = btn.getAttribute('data-provider');
            if (provider === this.selectedProvider) {
                btn.classList.add('border-accent', 'bg-accent/10');
                btn.classList.remove('border-white/10');
            } else {
                btn.classList.remove('border-accent', 'bg-accent/10');
                btn.classList.add('border-white/10');
            }
        });

        const settingsMap: Record<string, HTMLElement | null> = {
            'lm-studio': document.getElementById('lm-studio-settings'),
            'gemini': document.getElementById('gemini-settings'),
            'openai': document.getElementById('openai-settings'),
        };

        Object.entries(settingsMap).forEach(([key, el]) => {
            if (el) {
                el.classList.toggle('hidden', key !== this.selectedProvider);
            }
        });
    }

    private updateModelDatalist(): void {
        const datalist = document.getElementById('lm-studio-model-history');
        if (!datalist) return;
        const history = getModelHistory();
        datalist.innerHTML = history.map(model => `<option value="${model}">`).join('');
    }
}
