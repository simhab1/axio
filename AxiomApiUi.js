import {AxiomApiHelper} from './AxiomApiHelper'

export class AxiomApiForm {
    constructor() {
        this.fields = []
    }
    textField(label, name, placeholder = '', value = '') {
        this.fields.push({ type: "textfield", label, name, placeholder, value })

    }
    longTextField(label, name) {
        this.fields.push({ type: "textarea", label, name })
    }
    dataListToArray(label, name) {
        this.fields.push({ type: 'text_data_list_to_array', label, name })
    }
    display(callback) {
        const params = {
            name: "custom_form",
            title: "Form",
            form: this.fields
        }
        AxiomApiHelper.sendTabMessage("display_form", params).then(res => {
            callback(res)
        })
    }
}
