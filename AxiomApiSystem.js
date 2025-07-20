// TODO: Information about the currently running task
class AxiomApiSystem {
    // TODO: make work
    static taskInfo(callback) {
        chrome.storage.local.get("toolbar", res => {
            callback(res.toolbar.task)
        })
    }

    static lastRun() {
        return "nothing!"
    }

    static continue(input) {

    }
}