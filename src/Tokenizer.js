function Tokenizer(code){
    var index = 0;
    var tokens = [];
    var literals = new Set(['class', 'if', 'for', 'enum', 'expr']);

    function CreateToken(name, value){
        return {name:name, value:value};
    }

    function CreateTokenAndMoveIndex(name, value){
        var token = CreateToken(name, value);
        index+=value.length;
        return token;
    }

    function TryGetCurrent(){
        return index<code.length;
    }

    function Current(){
        return code[index];
    }

    function IsCharacter(c){
        return (c>='a' && c<='z') || (c>='A' && c<='Z') || c=='_';
    }

    function IsDigit(c){
        return (c>='0' && c<='9');
    }

    function IsAlphaNumeric(c){
        return IsCharacter(c) || IsDigit(c);
    }

    function Quote(endQuote){
        var start = index;
        index++;
        while(true){
            if(!TryGetCurrent())
                throw 'Quote not finished';
            var c = Current();
            index++;
            if(c == endQuote)
                return CreateToken('Quote', code.substring(start, index));
        }
    }

    function Instruction(){
        function CreateInstruction(text){
            return CreateToken(text, text);
        }

        var start = index;
        index++;
        while(true){
            if(!TryGetCurrent())
                return CreateInstruction(code.substring(start, index));
            var c = Current();
            if(IsAlphaNumeric(c))
                index++;
            else
                return CreateInstruction(code.substring(start, index));
        }
    }

    function Identifier(){
        function CreateIdentifier(text){
            if(literals.has(text))
                return CreateToken(text, text);
            return CreateToken('Identifier', text);
        }

        var start = index;
        index++;
        while(true){
            if(!TryGetCurrent())
                return CreateIdentifier(code.substring(start, index));
            var c = Current();
            if(IsAlphaNumeric(c))
                index++;
            else
                return CreateIdentifier(code.substring(start, index));
        }
    }

    function Number(){
        var start = index;
        index++;
        while(true){
            if(!TryGetCurrent())
                return CreateToken('Number', code.substring(start, index));
            var c = Current();
            if(IsDigit(c) || c=='.')
                index++;
            else
                return CreateToken('Number', code.substring(start, index));
        }
    }

    function Tokenize(){
        while(true){
            if(!TryGetCurrent())
                return undefined;
            var c = Current();
            if(c=='#')
                return Instruction();
            if(IsCharacter(c))
                return Identifier();
            if(IsDigit(c))
                return Number();
            if(c==' '){
                index++;
                continue;
            }
            if(c=="'")
                return Quote("'");
            if(c=='"')
                return Quote('"');
            return CreateTokenAndMoveIndex(c, c);
        }
    }

    while(true){
        var token = Tokenize();
        if(token==undefined)
            return tokens;
        tokens.push(token);
    }
}
