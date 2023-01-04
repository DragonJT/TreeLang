
class TokenReader{
    constructor(tokens){
        this.tokens = tokens;
        this.index = 0;
    }

    TryGetCurrent(){
        return this.index<this.tokens.length;
    }

    Current(){
        return this.tokens[this.index];
    }
}

function ParseError(msg){
    return {constructorType:'Error', msg:msg};
}

function CalcLineData(obj, line, parser){
    var deltaLine = line;
    var index = 0;
    for(var o of obj.body){
        var lastLineCount = parser.LineCount(o);
        deltaLine -= lastLineCount;
        if(deltaLine<0){
            var currentLine = deltaLine+lastLineCount;
            if(lastLineCount > 1 && currentLine > 0){
                return parser.LineData(o, currentLine-1);
            }
            return {obj:obj, parser:parser, index:index};
        }
        index++;
    }
    return {obj:obj, parser:parser, index:index};    
}

function ParseValue(reader, name){
    if(!reader.TryGetCurrent())
        return ParseError('End of File');
    var token = reader.Current();
    if(token.name == name){
        var result = {constructorType:name, value:token.value};
        reader.index++;
        return result;
    }
    return ParseError(`Expecting ${name} got ${token.name}`);
}

class PsLiteral{
    constructor(literal, color){
        this.literal = literal;
        this.color = color;
        this.isText = true;
    }

    Parse(reader){
        return ParseValue(reader, this.literal);
    }

    Draw(editor){
        editor.DrawText(this.literal, this.color);
    }
}

class PsPunctuation{
    constructor(punctuation, color){
        this.punctuation = punctuation;
        this.color = color;
        this.isText = false;
    }

    Parse(reader){
        return ParseValue(reader, this.punctuation);
    }

    Draw(editor){
        editor.DrawText(this.punctuation, this.color);
    }
}

class PsIdentifier{
    constructor(color){
        this.isText = true;
        this.color = color;
    }

    Parse(reader){
        return ParseValue(reader, 'Identifier');
    }

    Draw(editor, obj){
        editor.DrawText(obj.value, this.color);
    }
}

class PsObject{
    constructor(name){
        this.name = name;
        this.fields = [];
    }

    Literal(literal, color){
        this.fields.push({parser:new PsLiteral(literal, color)});
    }

    Punctuation(punctuation, color){
        this.fields.push({parser:new PsPunctuation(punctuation, color)});
    }

    Add(name, parser){
        this.fields.push({name:name, parser:parser});
    }

    Parse(reader){
        var o = {constructorType:this.name};
        for(var f of this.fields){
            var pv = f.parser.Parse(reader);
            if(pv.constructorType == 'Error')
                return pv;
            if(f.name)
                o[f.name] = pv;
        }
        if(this.body)
            o.body = [];
        return o;
    }

    Draw(editor, obj, indent){
        editor.Indent(indent);
        var f = this.fields;
        for(var i=0;i<f.length-1;i++){
            f[i].parser.Draw(editor, obj[f[i].name]);
            if(f[i].parser.isText && f[i+1].parser.isText)
                editor.Space();
        }
        f[f.length-1].parser.Draw(editor, obj[f[f.length-1].name]);  
        if(this.body){
            editor.DrawText('{', 'yellow');
            editor.NewLine();
            for(var o of obj.body){
                this.body.Draw(editor, o, indent+1);
            }
            editor.Indent(indent);
            editor.DrawText('}', 'yellow');
            editor.NewLine();
        }
        else{
            editor.NewLine();
        }
    }

    LineCount(obj){
        if(this.body){
            var count = 2;
            for(var o of obj.body){
                count+=this.body.LineCount(o);
            }
            return count;
        }
        return 1;
    }

    LineData(obj, line){
        return CalcLineData(obj, line, this.body);
    }
}

class PsOr{
    constructor(branches){
        this.branches = branches;
    }

    Parse(reader){
        var index = reader.index;
        for(var b of this.branches){
            reader.index = index;
            var pv = b.Parse(reader);
            if(pv.constructorType != 'Error')
                return pv;
        }
        return ParseError('No branches match');
    }
    
    Draw(editor, obj, indent){
        for(var b of this.branches){
            if(obj.constructorType == b.name){
                b.Draw(editor, obj, indent);
                return;
            }
        }
        if(obj.constructorType == 'EmptyLine'){
            editor.NewLine();
        }
        else if(obj.constructorType == 'Error'){
            editor.DrawText('Error: '+obj.msg, 'rgb(255,155,0)');
            editor.NewLine();
        }
        else{
            editor.DrawText('Error: Unknown type '+obj.constructorType);
            editor.NewLine();
        }
    }

    LineCount(obj){
        for(var b of this.branches){
            if(obj.constructorType == b.name){
                return b.LineCount(obj);
            }
        }
        return 1;
    }

    LineData(obj, line){
        for(var b of this.branches){
            if(obj.constructorType == b.name){
                return b.LineData(obj, line);
            }
        }
    }
}

class Parser{
    constructor(){
        var body = [];

        var expression =  new PsLiteral('expr', 'orange');

        var createVariable = new PsObject('createVariable');
        createVariable.Add('type', new PsIdentifier('rgb(0,155,255)'));
        createVariable.Add('name', new PsIdentifier('rgb(50,50,255)'));
        createVariable.Punctuation('=', 'yellow');
        createVariable.Add('value', expression);

        var assign = new PsObject('assign');
        assign.Add('name', new PsIdentifier('rgb(50,50,255)'));
        assign.Punctuation('=', 'yellow');
        assign.Add('value', expression);

        var method= new PsObject('method');
        method.Add('type', new PsIdentifier('rgb(0,155,255)'));
        method.Add('name', new PsIdentifier('rgb(50,50,255)'));
        method.Punctuation('(', 'yellow');
        method.Punctuation(')', 'yellow');
        method.body = new PsOr([createVariable, assign]);

        var field = new PsObject('field');
        field.Add('type', new PsIdentifier('rgb(0,155,255)'));
        field.Add('name', new PsIdentifier('rgb(50,50,255)'));

        var _class = new PsObject('class');
        _class.Literal('class', 'rgb(0,255,155)');
        _class.Add('name', new PsIdentifier('rgb(0,155,255)'));
        _class.body = new PsOr([method, field]);
        body.push(_class);

        this.body = new PsOr(body);
    }

    DeleteLine(obj, line){
        var lineData = this.LineData(obj, line);
        if(lineData.index>0){
            var count = lineData.parser.LineCount(lineData.obj.body[lineData.index-1]);
            lineData.obj.body.splice(lineData.index-1, 1);
            return count;
        }
        return 0;
    }

    LineCount(obj){
        var count = 0;
        for(var o of obj.body)
            count+=this.body.LineCount(o);
        return count;
    }

    LineData(obj, line){
        return CalcLineData(obj, line, this.body);
    }

    Draw(editor, obj){
        for(var i=0;i<obj.body.length;i++)
            this.body.Draw(editor, obj.body[i], 0);
    }

    Parse(tokens, obj, line){
        var reader = new TokenReader(tokens);
        var lineData = this.LineData(obj, line);
        var pv = lineData.parser.Parse(reader);
        lineData.obj.body.splice(lineData.index, 0, pv);
    }

    AddEmptyLine(obj, line){
        var lineData = this.LineData(obj, line);
        lineData.obj.body.splice(lineData.index, 0, {constructorType:'EmptyLine'});
    }
}