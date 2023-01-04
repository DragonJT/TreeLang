
function CreateContext(parent){
    var canvas = document.createElement('canvas');
    parent.appendChild(canvas);
    parent.style.margin = '0';
    parent.style.overflow = 'hidden';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    return canvas.getContext('2d');
}

function FileSave(suggestedName, content){
    async function Save(){
        const opts = {
            types: [{
              description: 'Source Code file',
              accept: {'text/plain': ['.txt']},
            }],
            suggestedName: suggestedName,
          };
        const handle = await window.showSaveFilePicker(opts);
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
    }
    Save().then();
}

function FileLoad(contents){
    async function Load(){
        const opts = {
            types: [{
              description: 'Source Code file',
              accept: {'text/plain': ['.txt']},
            }],
          };
        [fileHandle] = await window.showOpenFilePicker(opts);
        const file = await fileHandle.getFile();
        return await file.text();
    }
    Load().then(contents);
}

class CommandRunner{
    constructor(){
        this.parser = new Parser();
        this.line = 0;
        this.project = {body:[]};
        this.commands = [];
    }

    LastCommand(startsWith){
        if(this.commands.length>0){
            var lastCommand = this.commands[this.commands.length-1];
            var tokens = Tokenizer(lastCommand);
            if(tokens[0].value == startsWith)
                return true;
        }
        return false;
    }

    ProjectLineCount(){
        return this.parser.LineCount(this.project);
    }

    RunCommand(command){
        var tokens = Tokenizer(command);
        if(tokens.length>0){
            switch(tokens[0].value){
                case '#delete_line':
                    var deleteCount = this.parser.DeleteLine(this.project, this.line);
                    this.line -= deleteCount;
                    break;
                case '#goto':
                    var lineNum = tokens[1].value;
                    var line = parseFloat(lineNum);
                    this.line = line;
                    break;
                default:
                    this.parser.Parse(tokens, this.project, this.line);
                    this.line++;
                    break;
            }
        }
        else{
            this.parser.AddEmptyLine(this.project, this.line);
            this.line++;
        }
    }

    RunAndSaveCommand(command){
        this.RunCommand(command);
        this.commands.push(command);
    }

    RunAndReplaceCommand(command){
        this.RunCommand(command);
        this.commands[this.commands.length-1] = command;
    }

    MoveUp(){
        if(this.line>0){
            if(!this.LastCommand('#goto'))
                this.RunAndSaveCommand(`#goto ${this.line-1}`);
            else
                this.RunAndReplaceCommand(`#goto ${this.line-1}`);
        }
    }

    MoveDown(){
        if(this.line<=this.ProjectLineCount()){
            if(!this.LastCommand('#goto'))
                this.RunAndSaveCommand(`#goto ${this.line+1}`);
            else
                this.RunAndReplaceCommand(`#goto ${this.line+1}`);
        }
    }

    DeleteLine(){
        if(this.line > 0)
            this.RunAndSaveCommand('#delete_line');
    }

    Draw(editor){
        this.parser.Draw(editor, this.project);
    }

    RunFromBeginning(){
        this.line = 0;
        this.project = {body:[]};
        for(var c of this.commands){
            this.RunCommand(c);
        }
    }

    Save(){
        var content = '';
        for(var i=0;i<this.commands.length;i++){
            content+=this.commands[i];
            if(i<this.commands.length-1)
                content+='\n';
        }
        FileSave('save.txt', content);
    }

    Load(onload){
        FileLoad(c=>{
            this.commands = c.split('\n');
            this.RunFromBeginning();
            onload();
        });
    }
}

class CodeEditor{
    constructor(){
        this.fontSize = 20;
        this.lineSize = 30;
        this.font = 'Arial';
        this.ctx = CreateContext(document.body);
        this.commandLine = '';
        this.commandRunner = new CommandRunner();
    }

    Indent(indent){
        var indentWidth= this.ctx.measureText('    ').width;
        for(var i=0;i<indent;i++)
            this.x+=indentWidth;
    }

    Space(){
        this.x+=this.ctx.measureText(' ').width;
    }

    DrawText(text, color){
        this.ctx.fillStyle = color;
        this.ctx.fillText(text,this.x,this.y+this.fontSize);
        this.x+=this.ctx.measureText(text).width;
    }

    NewLine(){
        this.x = 0;
        this.y+=this.lineSize;
    }

    Update(){
        this.x = 0;
        this.y = 0;
        this.ctx.font = this.fontSize+'px '+this.font;
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0,0,this.ctx.canvas.width, this.ctx.canvas.height);
 
        this.commandRunner.Draw(this);

        this.ctx.fillStyle = 'rgb(50,50,255)';
        this.ctx.fillRect(0, this.commandRunner.line*this.lineSize, this.ctx.canvas.width, 4);

        this.ctx.fillStyle = 'rgb(200,200,200)';
        this.ctx.fillRect(0,this.ctx.canvas.height-100,this.ctx.canvas.width, this.ctx.canvas.height - 100);
        this.ctx.fillStyle = 'black';
        this.ctx.fillText(this.commandLine, 10, this.ctx.canvas.height - 50);
    }
    
    OnKeyDown(e){
        if(e.key == 'ArrowUp'){
            this.commandRunner.MoveUp();
        }
        else if(e.key == 'ArrowDown'){
            this.commandRunner.MoveDown();
        }
        else if(e.key == 'Enter'){
            this.commandRunner.RunAndSaveCommand(this.commandLine);
            this.commandLine = '';
        }
        else if(e.key == 'Backspace'){
            if(e.shiftKey)
                this.commandRunner.DeleteLine();
            else
                this.commandLine = this.commandLine.substring(0, this.commandLine.length-1);
        }
        if(e.key.length == 1){
            if(e.ctrlKey){
                if(e.key == 's'){
                    this.commandRunner.Save();
                }
                else if(e.key == 'l'){
                    this.commandRunner.Load(()=>this.Update());
                }
            }
            else{
                this.commandLine+=e.key;
            }
        }
        this.Update();
        if(e.key != 'F12')
            e.preventDefault();
    }
}


var codeEditor = new CodeEditor();
codeEditor.Update();
addEventListener('keydown', e=>codeEditor.OnKeyDown(e));