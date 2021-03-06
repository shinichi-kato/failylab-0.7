// BiomeBotのコア
import Part,{checkDictStructure} from './part.jsx';

export default class BiomeBot{
  /*
    BiomeBot クラス

    BiomeBotはパラメータ,パートの2階層からなるデータで定義される。

    パラメータには以下の内容が含まれる。
    id : 同一サーバー内でユニークな型式名
    displayName : ユーザが変更できるボットの名前
    photoURL : 画面に表示するAvatarのURL(firebase.auth)
    creatorUID : 作成者のuid(firebase.auth)
    timestamp : アップデートしたときのタイムスタンプ
    parts : 初期状態でのパートの実行順を格納したリスト
    memory : ボットの記憶
    
    パートには以下の内容が含まれる
    type : パートの型
    availability : 稼働率（パートが動作する確率,0≦a≦1)
    generosity : 寛容性（辞書のスコアが1-sを上回ったら採用）
    retention : 維持率（1-retentionの確率でこのパートがpartsの最後尾に移動)
    dictSource : 辞書


    ## パートの集合体による返答の生成

    Biomebotは返答を生成するため複数のpartによる競争的な動作を行う。
    partには処理される順番があり、初期状態はbot.partsに格納されている。
    その順番は内部的にbiomebot.partsに格納され、動作中の入れ替わりを保持する。


    ## 辞書
    dictSourceはJSON形式を基本とする。ただし先頭文字が#である行はコメント行として扱う。
    辞書のJSON部分は
    [
      [
        ["input11","input12","input13"...],
        ["output11","output12","output13"...]
      ],
      [
        ["input21","input22","input23"...],
        ["output21","output22","output23"...]
      ],
      .
      .
      .
    ]
    という構造とし、input11〜1nに近い入力文字列に対してoutput11~1nの中から
    ランダムに選んだ一つを返す。

    ■■人称代名詞の置換
    辞書の入力文字列、つまりユーザから受け取るセリフに現れるチャットボットの名前、
    「あなた」「君」など会話相手のボットを示す言葉は、{you}というタグに置き換える。
    また出力文字列、つまりボットの発言に含まれる{botNmae}はチャットボットの名前に、
    {you}は「あなた」「君」などに、{userName}はユーザの名前に置換される。
    これらのルールをリストにすると以下のようになる。

    入力文字列をタグ化                                             タグ
    --------------------------------------------------------------------
    inDictWordsForBot: ボットを表す言葉　{botName}さん 君 など      {bot}
    inDictWordsForUser:ユーザ自身を表す言葉 私 {userName} 僕など    {user}

    タグを出力文字列化                               出力する文字列
    --------------------------------------------------------
    outDictBotInWords: ボットを表すタグ {bot}        ボットの名前,私,僕など
                      ボット名を表すタグ {botName}  ボットの名前,私,僕など
    outDictUserInWords:ユーザを表すタグ {user}       ユーザさん、{userName}さんなど


    ■■　多人数チャットにおけるチャットボットの動作について　■■

		多人数が同時に参加するHubでは一対一の会話と同じ量でチャットボットが発言すると
		チャットボットの発現量が多くなりすぎる。ここで各チャットボットはパートの集合体で
		パート間の相互作用によりどのパートが発言するかを決めていた。この考え方を複数の
		ボットに拡張し、Hub用にパートの変数と似た以下のパラメータを設定する。
		
		・Hub用availablity
    ボットの発言はこの確率で実行される。通常より低めにすることで
    ボリュームを抑える
		
		・Hub用generosity
		通常のパートよりも低めの値を設定し、かなりスコアの高い返答のみを実行する。
		これにより「おはよう！」には全員が返事するが、普通の話題は特定のボットしか
		応答しないようになる。

		・Hub用retention
		一度応答したボットはアクティブ状態になる。
		毎回retentionチェックを行い、成功したらHub用availabilityは1になる。
		失敗したらHub用Availablityはもとの値になる。

		これらは現バージョンでは固定の隠しパラメータだが、		いずれ親密度や体調で
		変動するようにしたい。
    

  */
  constructor(hubParam){
    this.partContext=new Object();
    this.currentParts = JSON.parse(localStorage.getItem('BiomeBot.currentParts')) || [];
    this.hub={
      availability : hubParam.availability,
      generosity : hubParam.generosity,
      retention : hubParam.retention,
      isActive : false
    };
    this.memory= {queue:[],tags:{'{notFound}':['・・・']}};
    this.tagKeys=[];
 
    
  }

  setParam({settings,forceReset=false}){
    this.id = settings.id;
    this.displayName = settings.displayName;
    this.photoURL = settings.photoURL;
    this.creatorUID = settings.creatorUID;
    this.creatorName = settings.creatorName;
    this.timestamp = settings.timestamp;
    this.parts = settings.parts;

    if(forceReset){
      this.memory = {
        queue:this.memory.queue ,
        ...settings.memory 
      };
      this.currentParts = settings.parts;

    }else{
      this.memory = {...settings.memory };
      
      if(!("queue" in settings.memory)){
        this.memory.queue=[];
      }
    
      if(this.currentParts.length===0){
        this.currentParts = [...this.parts];
      }
    }

    // localStorageとアップロードの不整合でmemory.tagsがない場合がある
    this.tagKeys = this.memory.tags ? Object.keys(this.memory.tags) : [];
    
  }

  setPart({settings,forceReset=false}){
    let part = new Part(settings,forceReset);
    let result = part.compile(settings.dictSource,this.memory)
    if (result === 'ok'){
      part.setup()
      this.partContext[settings.name] = part;
      
     }
     return result;
  }


  dump(){
    localStorage.setItem(`BiomeBot.memory`,JSON.stringify(this.memory));
    localStorage.setItem(`BiomeBot.currentParts`,JSON.stringify(this.currentParts));
  }

  


  reply(message){
    /* message
    displayName:reply.displayName,
            photoURL:reply.photoURL,
            text:reply.text,
            speakerId:botId,
            timestamp
        を受け取り一対一チャットにおける返答を生成 */

    return new Promise((resolve,reject)=>{

      let text = "";
      if(this.memory.queue.length !== 0){
        // queueがあったらそれを使う

        text = this.memory.queue.shift();
      }
      else{

        let result=this._partCircuit(
          this._tagifyNames(message)) || "・・・";
  
        text = result.text;

        // 返答中のタグを展開
        text = this._untagify(text);
        text = this._untagifyNames(result,text,message);

        // <BR>があったらqueue化
        if(text.indexOf('<BR>') !== -1){
          const texts = text.split('<BR>');
          text = texts.shift();
          this.memory.queue.push(text);
        }
    
      }
      
      this.dump();

      resolve({
        botId:this.id,
        text:text,
        displayName:this.displayName,
        photoURL:this.photoURL,
      });
      
    });
  }

  hubReply(message){
    /* 多人数チャットにおける返答生成 */
    let result = {text:null};
    return new Promise((resolve,reject)=>{
      if(this.memory.queue.length !== 0){
        result.text = this.memory.queue.shift();
      }     
      else{
        while(1){
          //hub availablity check
          if(!this.hub.isActive && Math.random() > this.hub.availability){
            break;
          }
          // hub generosity
          result = this._partCircuit(
            this._tagifyNames(message));
          if(result.score < 1-this.hub.generosity){
            break;
          }
          

          // hub retention
          if(Math.random() > this.hub.retention){
            this.hub.isActive = false;
            // availabilityを戻す
          }else{
            // availablityを上げる
            this.hub.isActive = true;

          }
          break;
        }

      }


      let text = result.text;
      text = this._untagify(text);
      text = this._untagifyNames(result,text,message);

      // <BR>があったらqueue化
      if(text.indexOf('<BR>') !== -1){
        const texts = text.split('<BR>');
        text = texts.shift();
        this.memory.queue.push(text);
      }

      this.dump();

      resolve({
        botId:this.id,
        text:text,
        displayName:this.displayName,
        photoURL:this.photoURL,
      });
    });
  }

  _partCircuit(message){
    let result = {text:"{notFound}"};
    if(this.memory.queue.length !== 0){
      result.text = this.memory.queue.shift();
    }
    else{
      for(let i in this.currentParts){
        let partName=this.currentParts[i];
      
        let part = this.partContext[partName];
        // availability check
        if(Math.random() > part.availability){
          // console.log("availability insufficient")
          continue;
        }

        // generousity check
        let reply = part.replier(message,this.memory);
        if(reply.score < 1-part.generosity){
          // console.log(`generousity:score ${reply.score} insufficient`);
          continue
        }
        
        result = {...reply}

        // 改行\nあったらqueueに送る
        if(reply.text.indexOf('<BR>') !== -1){
          const replies = reply.text.split('<BR>');
          reply.text = replies.shift();
          this.memory.queue.push(replies);
        }

        // retention check
        if(Math.random() > part.retention){
          // このパートを末尾に
          this.currentParts.slice(i,1);
          this.currentParts.push(partName);
          // currentPartsの順番を破壊するのでforループを抜ける
          break;
        }

        // retentionチェックがOKだったらこのパートを先頭に
        this.currentParts.slice(i,1);
        this.currentParts.unshift(partName);
        // currentPartの順場案を破壊するのでループを抜ける
        break;

      }
    }

    this.dump();      
    
    return(result);
      
    
  }

  _tagifyNames(message){
    /* ユーザ発言に含まれるユーザ名、ボット名をそれぞれ{userName},{botName}に置き換える */
    let text = message.text || "";
    text = text.replace(new RegExp(this.displayName,"g"),"{botName}");
    text = text.replace(new RegExp(message.displayName,"g"),"{userName}");
    return {...message,text:text};
  }

  _untagifyNames(result,text,message){
    /* {userName},{botName}をユーザ名、ボット名に置き換える */
    text = text.replace(/{botName}/g,this.displayName);
    text = text.replace(/{userName}/g,message.displayName);
    return text;

  }

  _untagify(text){
    /* messageに含まれるタグを文字列に戻す再帰的処理 */
    if(text){
      for (let tag of this.tagKeys){
        if(text.indexOf(tag) !== -1){
          text = text.replace(/(\{[a-zA-Z0-9]+\})/g,(whole,tag)=>(this._expand(tag)));
        }
      }
    }
    return text;
  }
    
 

  _expand(tag){
    const items = this.memory.tags[tag];
    if(!items){ return tag}
   let item = items[Math.floor( Math.random() * items.length)];
    
    item = item.replace(/(\{[a-zA-Z0-9]+\})/g,(whole,tag)=>(this._expand(tag))
    )
    return item
  }

 
}

function isObject(item){
  return typeof item === 'object' && item !== null && !Array.isArray(item);
}

function isArrayOfStr(items){
  if(Array.isArray(items)){
    for (let item of items){
      if(typeof item !== 'string') { return false; }
    }
    return true;
  }
  return false;
}

function checkArrayOfStr(name,items){
  if(!isArrayOfStr(items)){
    return name+"が文字列のリストではありません "
  }
  return "";
}

export function checkMemoryStructure(name,memorySource){
	/* メモリーは
	memory = {
    inDictWordsForBot:[
      '{botName}さん','{botName}君','{botName}氏',
      '{botName}','あなた','おまえ','君'],
    inDictWordsForUser:[
      '{userName}','私','僕','俺'],
    outDictBotInWords:[
      '{botName}','私'
    ],
    outDictUserInWords:[
      '{userName}さん','あなた',
    ],
    queue:['次の返答','次の次の返答']
    tags:{'{example}':['例']},
  };
  という構造になっている。
  これに一致しない部分はmemoryから除去するとともにエラーメッセージを返す。
  part.jsxのfunction checkDictStructure(name,source)参照
  */
  
  let errorMessage = "";
  let memory = {};
  try{
    memory = JSON.parse(memorySource);
  }
  catch(e){
    if(e instanceof SyntaxError){
      errorMessage=
      errorMessage = 
      `${name}の line:${e.lineNumber} column:${e.columnNumber} に文法エラーがあります`;
      return {error:errorMessage}
    }
  }

  if(isObject(memory)){
    // スクリプト全体

    errorMessage = 
      checkArrayOfStr("inDictWordsForBot",memory.inDictWordsForBot)+
      checkArrayOfStr("inDictWordsForUser",memory.inDictWordsForUser)+
      checkArrayOfStr("outDictBotInWords",memory.outDictBotInWords)+
      checkArrayOfStr("outDictUserInWords",memory.outDictUserInWords);
    
    if(errorMessage.length){
      // 人称
      return {
        error:errorMessage
      }
    }


    if(memory.tags && isObject(memory.tags)){
      const tagKeys = Object.keys(memory.tags);
      let newTags=new Object();

      for(let key of tagKeys){
        if(!isArrayOfStr(memory.tags[key])){
          return {
            error:`${key}の内容が文字列のリストになっていません`
          }
          
        }
      }
      return {
        error:"エラーはありません"

      }
    }
    else{
      // tagsがオブジェクトでないエラー
      return {error:"{name}は連想配列にしてください"}
    }
      
  }
  // 全体が連想配列でないエラー
  return {error:"memoryに必要なデータが格納されていません"}
}	