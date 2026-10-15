import { _t } from '@web/core/l10n/translation';
import { useService } from '@web/core/utils/hooks';
import { useRef, useState, onMounted } from '@odoo/owl';
import { ConfirmationDialog } from '@web/core/confirmation_dialog/confirmation_dialog';

export class LabelInputDialog extends ConfirmationDialog {
    static template = 'web_widget_mapbox_gl.LabelInputDialog';
    static props = {
        ...ConfirmationDialog.props,
        initialValue: { type: String, optional: true },
        isEdit: { type: Boolean, optional: true },
    };
    static defaultProps = {
        ...ConfirmationDialog.defaultProps,
        initialValue: '',
        isEdit: false,
    };

    static MAX_LENGTH = 100;

    setup() {
        super.setup();
        this.inputRef = useRef('labelInput');
        this.notificationService = useService('notification');

        this.state = useState({
            charCount: this.props.initialValue?.length ?? 0,
        });

        onMounted(() => {
            if (this.inputRef.el) {
                this.inputRef.el.value = this.props.initialValue;
                this.inputRef.el.focus();
            }
        });
    }

    _onInput() {
        this.state.charCount = this.inputRef.el?.value?.length ?? 0;
    }

    async _confirm() {
        const raw = this.inputRef.el?.value ?? '';
        // Normalize Windows line endings and strip leading/trailing blank lines
        const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
        if (!text) {
            this.notificationService.add(_t('Label cannot be empty. Consider removing the label instead.'), {
                type: 'warning',
            });
            return;
        }
        if (text.length > this.maxLength) {
            this.notificationService.add(_t('Label must be %(len)s characters or fewer.', { len: this.maxLength }), {
                type: 'danger',
            });
            return;
        }
        return this.execButton(this.props.confirm, text);
    }

    async execButton(callback, label) {
        if (this.isProcess) {
            return;
        }
        this.setButtonsDisabled(true);
        if (callback) {
            let shouldClose;
            try {
                shouldClose = await callback(label);
            } catch (e) {
                this.props.close();
                throw e;
            }
            if (shouldClose === false) {
                this.setButtonsDisabled(false);
                return;
            }
        }
        this.props.close();
    }

    get maxLength() {
        return LabelInputDialog.MAX_LENGTH;
    }

    // Intended to replace the props title and confirmLabel to support dynamic text based on whether we're adding or editing a label
    get title() {
        return this.props.isEdit ? _t('Edit Label') : _t('Add Label');
    }

    get confirmLabel() {
        return this.props.isEdit ? _t('Update') : _t('Add');
    }
}
