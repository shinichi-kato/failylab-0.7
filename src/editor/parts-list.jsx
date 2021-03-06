import React ,{useState} from 'react';
import { makeStyles, withStyles, createStyles } from '@material-ui/core/styles';

import Box from '@material-ui/core/Box';
import IconButton from '@material-ui/core/IconButton';
import Button from '@material-ui/core/Button';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';

import ArrowUpwardIcon from '@material-ui/icons/ArrowUpward';
import ArrowDownwardIcon from '@material-ui/icons/ArrowDownward';
import DeleteIcon from '@material-ui/icons/Delete';
import EditIcon from '@material-ui/icons/Edit';
import AddIcon from '@material-ui/icons/Add';
import Popover from '@material-ui/core/Popover';

import DictSizeProgress from './dict-size-progress.jsx';


const useStyles = makeStyles(theme => createStyles({
	root: {
    height: 300,
    overflowY: "scroll",
	},
	textField: {
		padding: "2px 4px",
		backgroundColor:theme.palette.background.paper,

	},
	readOnlyField:{
		padding: theme.spacing(1),
		backgroundColor:"#e0e0e0",	
  },
  part:{
    backgroundColor:"#e0e0e0",
    width: "100%",
    
  },
  caption:{
    opacity:0.4,
  },
  progress:{
    width: 120,
    padding: theme.spacing(1),
  },
  newPart:{
    border: "dashed 4px #cccccc",
    width: "95%",
  }

}));



function PartCard(props){
  const {name,_dictSourceByteSize,index} = props;
  const classes = useStyles();
  const [anchorEl,setAnchorEl] = useState(null);

  const open = Boolean(anchorEl);
  const id = open ? 'delete-dialog' : undefined;

  function handleClickDelete(index){
    setAnchorEl(null);
    props.handleDeletePart(index);
  }

  return(
    <ListItem key={name}>
      <Box display="flex"
        flexDirection="row"
        className={classes.part}
        key={name}
        >
          <Box alignSelf="center">
            <IconButton
              size="small"
              onClick={e=>props.handleRaisePart(index)}
            >
              <ArrowUpwardIcon/>
            </IconButton>
            <IconButton
              size="small"
              onClick={e=>props.handleDropPart(index)}
            >
              <ArrowDownwardIcon/>
            </IconButton>
          </Box>
          <Box 
            flexGrow={1} 
            display="flex" 
            flexDirection="column"
          >
            <Box className={classes.progress}>
              {name}
            </Box>
            <Box display="flex" flexDirection="row">
              <Box>
                辞書
              </Box>
              <Box className={classes.progress}>
                <DictSizeProgress name={name} size={_dictSourceByteSize}/>
              </Box>
            </Box>
          </Box>
          <Box alignSelf="center">
            <IconButton 
              onClick={e=>props.handleEditPart(name)}
              size="small">
              <EditIcon/>
            </IconButton>
            <IconButton
              aria-describedby={id}
              onClick={e=>setAnchorEl(e.currentTarget)}
              size="small">
              <DeleteIcon/>
            </IconButton>
            <Popover
              id={id}
              open={open}
              anchorEl={anchorEl}
              onClose={()=>setAnchorEl(null)}
              anchorOrigin={{vertical: 'bottom',horizontal:'left'}}

            >
              <Button onClick={()=>handleClickDelete(index)}>
                削除
              </Button>
            </Popover>
          </Box>
      </Box>
    </ListItem>
  )
}


function NewPartCard(props){
  const classes=useStyles();

  return (
    <ListItem key="__new__">
      <Box display="flex"
        flexDirection="row"
        justifyContent="center"
        className={classes.newPart}
        alignSelf="center">
        <Box alignSelf="center">
          <Button
            size="large"
            onClick={props.handleAddPart}
          >
            <AddIcon/>パートを追加
          </Button>
        </Box>
      </Box>
    </ListItem>

  )
}


export default function PartsList(props){

  const classes=useStyles();
  const {parts,partContext} = props;
  console.log("parts=",parts)
  const partItems = parts.map((part,index)=>(
    <PartCard index={index} name={part} {...partContext[part]}
      handleRaisePart={props.handleRaisePart}
      handleDropPart={props.handleDropPart}
      handleEditPart={props.handleEditPart}
      handleDeletePart={props.handleDeletePart}
    />
  ));

  return (
    <List className={classes.root}>
      {partItems}
      <NewPartCard handleAddPart={props.handleAddPart}/>
    </List>
  )
}