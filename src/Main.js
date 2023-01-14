
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
        this.project = [];
        this.commands = [];
    }

    LastCommand(startsWith){
        if(this.commands.length>0){
            var lastCommand = this.commands[this.commands.length-1];
            var tokens = Tokenizer(lastCommand);
            if(tokens.length>0 && tokens[0].value == startsWith)
                return true;
        }
        return false;
    }

    RunCommand(command, save){
        var tokens = Tokenizer(command);
        if(tokens.length>0){
            switch(tokens[0].value){
                case '#delete_line':
                    var deleteCount = this.parser.DeleteLine(this.project, this.line);
                    this.line -= deleteCount;
                    if(save)
                        this.commands.push(command);
                    break;
                case '#goto':
                    var lineNum = tokens[1].value;
                    var line = parseFloat(lineNum);
                    this.line = line;
                    if(this.line<0)
                        this.line = 0;
                    if(this.line>=this.project.length)
                        this.line = this.project.length;
                    if(save){
                        if(this.LastCommand('goto'))
                            this.commands[this.commands.length-1] = command;
                        else
                            this.commands.push(command);
                    }
                    break;
                default:
                    if(this.parser.Parse(tokens, this.project, this.line)){
                        this.line++;
                        if(save)
                            this.commands.push(command);
                    }
                    break;
            }
        }
        else{
            this.parser.AddEmptyLine(this.project, this.line);
            this.line++;
            if(save)
                this.commands.push(command);
        }
    }

    MoveUp(){
        this.RunCommand(`#goto ${this.line-1}`, true);
    }

    MoveDown(){
        this.RunCommand(`#goto ${this.line+1}`, true);
    }

    DeleteLine(){
        if(this.line > 0)
            this.RunCommand('#delete_line', true);
    }

    Draw(editor){
        this.parser.Draw(editor, this.project);
    }

    RunFromBeginning(){
        this.line = 0;
        this.project = [];
        for(var c of this.commands){
            this.RunCommand(c, false);
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
        this.lastIsText = false;
    }

    Space(){
        this.x+=this.ctx.measureText(' ').width;
        this.lastIsText = false;
    }

    DrawText(text, color, isText){
        if(this.lastIsText && isText){
            this.Space();
        }
        this.ctx.fillStyle = color;
        this.ctx.fillText(text,this.x,this.y+this.fontSize);
        this.x+=this.ctx.measureText(text).width;
        this.lastIsText = isText;
    }

    NewLine(){
        this.x = 0;
        this.y+=this.lineSize;
        this.lastIsText = false;
    }

    Update(){
        this.lastIsText = false;
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
            this.commandRunner.RunCommand(this.commandLine, true);
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