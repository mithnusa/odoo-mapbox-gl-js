import { _t } from '@web/core/l10n/translation';
import { useService } from '@web/core/utils/hooks';
import { proxy, signal, t, useProps, onMounted } from '@odoo/owl';
import { ConfirmationDialog, confirmationDialogProps } from '@web/core/confirmation_dialog/confirmation_dialog';

const labelInputDialogProps = {
    ...confirmationDialogProps,
    initialValue: t.string().optional(''),
    isEdit: t.boolean().optional(false),
};

export class LabelInputDialog extends ConfirmationDialog {
    static template = 'web_widget_mapbox_gl.LabelInputDialog';
    props = useProps(labelInputDialogProps);

    static MAX_LENGTH = 100;

    setup() {
        super.setup();
        this.inputRef = signal.ref();
        this.notificationService = useService('notification');

        this.state = proxy({
            charCount: this.props.initialValue?.length ?? 0,
        });

        onMounted(() => {
            if (this.inputRef()) {
                this.inputRef().value = this.props.initialValue;
                this.inputRef().focus();
            }
        });
    }

    _onInput() {
        this.state.charCount = this.inputRef()?.value?.length ?? 0;
    }

    async _confirm() {
        const raw = this.inputRef()?.value ?? '';
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
