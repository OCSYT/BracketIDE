const Output = document.getElementById('Output');
const CommandInput = document.getElementById('CommandInput');
const SidebarResizer = document.getElementById('SidebarResizer');
const ConsoleResizer = document.getElementById('ConsoleResizer');
const Container = document.getElementById('Container');
const Sidebar = document.getElementById('Sidebar');
const ConsoleDiv = document.getElementById('Console');
const Files = document.getElementById('Files');

let CodeMirrorInstance = CodeMirror(document.getElementById("CodeEditor"), {
    mode: "javascript",
    lineNumbers: true,
    lineWrapping: false,
    theme: "default",
    indentUnit: 4,
    matchBrackets: true,
    viewportMargin: Infinity,
    extraKeys: {
        "Ctrl-S": function () {
            window.electronAPI.saveFile(CodeMirrorInstance.getValue());
        }
    }
});

document.getElementById('OpenFolderBtn').addEventListener('click', async () => {
    const Result = await window.electronAPI.openFolder();
    if (!Result) return;

    Files.textContent = ""; // faster than innerHTML
    const FileListContainer = document.createElement('div');
    FileListContainer.innerHTML = `<h3>Files in ${Result.Path}</h3>`;

    const CreateFileDropdown = (Items) => {
        const List = document.createElement('ul');
        List.classList.add('file-list');

        Items.forEach(Item => {
            const ListItem = document.createElement('li');

            if (Item.Type === 'directory') {
                const FolderElement = document.createElement('div');
                FolderElement.innerText = Item.Name;
                FolderElement.classList.add('folder-entry'); // styleable class
                FolderElement.dataset.path = Item.Path;
                FolderElement.dataset.loaded = "false";

                const FolderIcon = document.createElement('span');
                FolderIcon.classList.add('folder-icon');
                FolderElement.prepend(FolderIcon);

                const SubList = document.createElement('ul');
                SubList.classList.add('file-list');
                SubList.style.display = "none"; // initially hidden
                ListItem.appendChild(FolderElement);
                ListItem.appendChild(SubList);

                FolderElement.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const IsOpen = ListItem.classList.toggle('open');

                    if (IsOpen) {
                        SubList.style.display = "block";
                        if (FolderElement.dataset.loaded === "false") {
                            const Children = await window.electronAPI.loadChildren(Item.Path);
                            const ChildrenItems = CreateFileDropdown(Children.Items);
                            SubList.replaceWith(ChildrenItems);
                            ListItem.appendChild(ChildrenItems);
                            FolderElement.dataset.loaded = "true";
                        }
                    } else {
                        SubList.style.display = "none";
                    }
                });
            }

            else if (Item.Type === 'file') {
                const FileElement = document.createElement('div');
                FileElement.innerText = Item.Name;
                FileElement.classList.add('file-entry');
                FileElement.dataset.path = Item.Path;

                const FileIcon = document.createElement('span');
                FileIcon.classList.add('file-icon');
                FileElement.prepend(FileIcon);

                FileElement.addEventListener('click', async () => {
                    const FileData = await window.electronAPI.loadFile(Item.Path);
                    if (FileData) {
                        CodeMirrorInstance.setValue(FileData);
                    }
                });

                ListItem.appendChild(FileElement);
            }

            else if (Item.Type === 'invalid-file') {
                const InvalidFileElement = document.createElement('div');
                InvalidFileElement.innerText = Item.Name;
                InvalidFileElement.classList.add('invalid-file');

                const InvalidFileIcon = document.createElement('span');
                InvalidFileIcon.classList.add('file-icon-invalid');
                InvalidFileElement.prepend(InvalidFileIcon);

                ListItem.appendChild(InvalidFileElement);
            }

            List.appendChild(ListItem);
        });

        return List;
    };

    const SidebarItems = Result.Items;
    const SidebarContent = CreateFileDropdown(SidebarItems);

    FileListContainer.appendChild(SidebarContent);
    Files.appendChild(FileListContainer);
});


document.getElementById('SaveBtn').addEventListener('click', () => {
    window.electronAPI.saveFile(CodeMirrorInstance.getValue());
});

window.electronAPI.initalize();

CommandInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const Command = CommandInput.value;
        window.electronAPI.runCommand(Command);
        CommandInput.value = '';
    }
});

window.electronAPI.onOutput((event, Message) => {
    Output.innerHTML = Message;
    Output.scrollTop = Output.scrollHeight;
});

let IsResizingSidebar = false;
let StartX;
let InitialSidebarWidth;

SidebarResizer.addEventListener('mousedown', (e) => {
    IsResizingSidebar = true;
    StartX = e.clientX;
    InitialSidebarWidth = Sidebar.offsetWidth;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
});

document.addEventListener('mousemove', (e) => {
    if (!IsResizingSidebar) return;
    const DeltaX = e.clientX - StartX;
    const NewWidth = InitialSidebarWidth + DeltaX;
    if (NewWidth >= 150 && NewWidth <= window.innerWidth * 0.75) {
        Sidebar.style.width = `${NewWidth}px`;
        Sidebar.style.minWidth = `${NewWidth}px`;
    }
});

document.addEventListener('mouseup', () => {
    if (!IsResizingSidebar) return;
    IsResizingSidebar = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
});

let IsResizingConsole = false;
let StartY;
let InitialConsoleHeight;

ConsoleResizer.addEventListener('mousedown', (e) => {
    IsResizingConsole = true;
    StartY = e.clientY;
    InitialConsoleHeight = ConsoleDiv.offsetHeight;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
});

document.addEventListener('mousemove', (e) => {
    if (!IsResizingConsole) return;
    const DeltaY = e.clientY - StartY;
    const NewHeight = InitialConsoleHeight - DeltaY;
    if (NewHeight >= 150 && NewHeight <= window.innerHeight * 0.75) {
        ConsoleDiv.style.height = `${NewHeight}px`;
        ConsoleDiv.style.minHeight = `${NewHeight}px`;
    }
});

document.addEventListener('mouseup', () => {
    if (!IsResizingConsole) return;
    IsResizingConsole = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
});

window.addEventListener('resize', ApplyBounds);

function ApplyBounds() {
    const CurrentSidebarWidth = Sidebar.offsetWidth;
    if (CurrentSidebarWidth > window.innerWidth * 0.75) {
        Sidebar.style.width = `${window.innerWidth * 0.75}px`;
        Sidebar.style.minWidth = `${window.innerWidth * 0.75}px`;
    }

    const CurrentConsoleHeight = ConsoleDiv.offsetHeight;
    if (CurrentConsoleHeight > window.innerHeight * 0.75) {
        ConsoleDiv.style.height = `${window.innerHeight * 0.75}px`;
        ConsoleDiv.style.minHeight = `${window.innerHeight * 0.75}px`;
    }
}