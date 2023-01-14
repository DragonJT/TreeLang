
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

function ParseToken(reader, name){
    if(!reader.TryGetCurrent())
        return {error:true, msg:'OutOfRange'};
    var current = reader.Current();
    if(current.name == name){
        reader.index++;
        return {error:false, value:current.value};
    }
    return {error:true, msg:`${name} doesn't match ${current.name}`};
}

class PsToken{
    constructor(name, color, isText){
        this.name = name;
        this.color = color;
        this.isText = isText;
    }

    Parse(reader){
        return ParseToken(reader, this.name);
    }

    Draw(editor, parseResult){
        editor.DrawText(parseResult.value, this.color, this.isText);
    }
}

class PsObject{
    constructor(fields){
        this.fields = fields;
    }

    Parse(reader){
        var parseResults = [];
        for(var f of this.fields){
            var p = f.Parse(reader);
            parseResults.push(p);
            if(p.error)
                return p;
        }
        return {error:false, parseResults:parseResults};
    }

    Draw(editor, parseResult){
        for(var i=0;i<this.fields.length;i++){
            this.fields[i].Draw(editor, parseResult.parseResults[i]);
        }
    }

    GetBody(parseResult){
        return this.body;
    }
}

class PsWhileDeliminator{
    constructor(element, deliminator, minLength, oddOnlyLength){
        this.element = element;
        this.deliminator = deliminator;
        this.minLength = minLength;
        this.oddOnlyLength = oddOnlyLength;
    }

    GetReturnObj(array){
        if(array.length<this.minLength){
            return {error:true, array:array, msg:`Array length = ${array.length} when it should be >= ${this.minLength}`};
        }
        else{
            if(this.oddOnlyLength){
                if(array.length%2 == 0)
                    return {error:true, array:array, msg:`Array length is ${array.length}. It should be odd.`};
                return {error:false, array:array}
            }else
                return {error:false, array:array};
        }
    }

    Parse(reader){
        var array = [];
        while(true){
            var pe = this.element.Parse(reader);
            if(pe.error){
                return this.GetReturnObj(array);
            }
            array.push(pe);
            var pd = this.deliminator.Parse(reader);
            if(pd.error){
                return this.GetReturnObj(array);
            }
            array.push(pd);
        }
    }

    Draw(editor, parseResult){
        for(var i=0;i<parseResult.array.length;i+=2){
            this.element.Draw(editor, parseResult.array[i]);
            if(i+1 < parseResult.array.length)
                this.deliminator.Draw(editor, parseResult.array[i+1]);
        }
    }
}

class PsOr{
    constructor(branches){
        this.branches = branches;
    }

    Parse(reader){
        var startIndex = reader.index;
        var msg = undefined;
        var msgIndex = -1;
        for(var i=0;i<this.branches.length;i++){
            reader.index = startIndex;
            var p = this.branches[i].Parse(reader);
            if(!p.error)
                return {error:false, branch:i, parseResult:p};
            else{
                if(reader.index>msgIndex){
                    msgIndex=reader.index;
                    msg = p.msg;
                }
            }
        }
        return {error:true, msg:msg};
    }   

    GetBody(parseResult){
        return this.branches[parseResult.branch].GetBody(parseResult.parseResult);
    }

    Draw(editor, parseResult){
        this.branches[parseResult.branch].Draw(editor, parseResult.parseResult);
    }
}

class PsCircular{
    Parse(reader){
        return this.parser.Parse(reader);
    }

    GetBody(parseResult){
        return this.parser.GetBody(parseResult);
    }

    Draw(editor, parseResult){
        this.parser.Draw(editor, parseResult);
    }
}

class Parser{
    constructor(){
        var expression = new PsCircular();
        var identifier = new PsToken('Identifier', 'rgb(50,50,255)', true);
        var type = new PsToken('Identifier', 'rgb(0,155,255)', true);
        var longIdentifier = new PsWhileDeliminator(identifier, new PsToken('.', 'yellow', false), 1, true);

        var parenthesisExpression = new PsObject([new PsToken('(', 'yellow', false), expression, new PsToken(')', 'yellow', false)]);

        var value = new PsOr([new PsToken('Number', 'magenta', false), longIdentifier, parenthesisExpression]);

        var operators = new PsOr([new PsToken('+', 'orange', false), 
            new PsToken('-', 'orange', false),
            new PsToken('*', 'orange', false),
            new PsToken('/', 'orange', false)]);

        expression.parser = new PsWhileDeliminator(value, operators, 1, true);

        var createVariable = new PsObject([
            type,
            identifier,
            new PsToken('=', 'yellow', false),
            expression]);

        var assign = new PsObject([
            longIdentifier,
            new PsToken('=', 'yellow', false),
            expression]);

        var method = new PsObject([
            type,
            identifier,
            new PsToken('(', 'yellow', false),
            new PsToken(')', 'yellow', false)]);
        method.body = new PsOr([createVariable, assign]);

        var field = new PsObject([type, identifier]);

        var _class = new PsObject([
            new PsToken('class', 'rgb(0,255,155)', true), 
            new PsToken('Identifier', 'rgb(0,155,255)', true)]);
        _class.body = new PsOr([method, field]);

        var struct = new PsObject([
            new PsToken('struct', 'rgb(0,255,155)', true), 
            new PsToken('Identifier', 'rgb(0,155,255)', true)]);
        struct.body = new PsOr([field, method]);

        this.body = new PsOr([_class, struct]);
    }

    CountBodyFromClose(project, line){
        var count = 1;
        var indent = 1;
        var l = line-1;
        while(true){
            if(project[l].openBody){
                indent--;
                if(indent==0)
                    return count+1;

            }
            if(project[l].closeBody)
                indent++;
            l--;
            count++;
        }
    }

    AddEmptyLine(project, line){
        project.splice(line, 0, {emptyLine:true});
    }

    DeleteLine(project, line){
        if(line>0){
            if(project[line-1].closeBody){
                var count = this.CountBodyFromClose(project, line-1);
                project.splice(line-count, count);
                return count;
            }
            else{
                project.splice(line-1, 1);
                return 1;
            }
        }
        return 0;
    }

    Draw(editor, project){  
        var indent = 0;
        for(var p of project){
            if(p.emptyLine){
            }
            else if(p.closeBody){
                indent--;
                editor.Indent(indent);
                editor.DrawText('}', 'yellow', false);
            }
            else{
                editor.Indent(indent);
                p.parser.Draw(editor, p);
                if(p.openBody){
                    editor.DrawText('{', 'yellow', false);
                    indent++;
                }
            }
            editor.NewLine();
        }
    }

    Parse(tokens, project, line){
        var reader = new TokenReader(tokens);
        var parser = this.body;
        if(line<project.length)
            parser = project[line].parser;
        var p = parser.Parse(reader);
        if(!p.error){
            var body = parser.GetBody(p);
            p.parser = parser;
            if(body){
                p.openBody = true;
                project.splice(line, 0, ...[p,{closeBody:true, parser:body}]);
            }else
                project.splice(line, 0, p);
            return true;
        }
        else{
            reader.index = 0;
            alert(`Error: ${p.msg}`);
            return false;
        }
    }
}