import * as React from 'react';
import { useEffect, useState } from 'react';
import { StyleSheet, Image, View, Text, TouchableOpacity, TextInput, Keyboard, FlatList, Modal, TouchableWithoutFeedback, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Avatar, Card, Paragraph } from 'react-native-paper';
import { fetchUserData } from '../Main/UserData';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, getDocs, collection, deleteDoc, query, addDoc, where, onSnapshot } from 'firebase/firestore';
import { FIREBASE_AUTH, FIREBASE_DB, FIREBASE_STORAGE } from '../../../FirebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { UserProfileScreenNavigationProp } from '../../types';
import {ref, deleteObject} from 'firebase/storage';

interface PostData {
  postImage: string;
  description?: string;
  likes?: string[];
  comments?: { id: string; userId: string; text: string }[];
}

interface PostCardProps {
  postData: PostData;
  uid: string;
  postId: string;
}

const PostCard = ({ postData, uid, postId }: PostCardProps) => {
  const [user, setUser] = useState<any>(null);
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState<{ id: string; userId: string; text: string }[]>([]);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const navigation = useNavigation<UserProfileScreenNavigationProp>();
  useEffect(() => {
    const fetchData = async () => {
      try {
        const userData = await fetchUserData(uid);
        setUser(userData);

        const postRef = doc(FIREBASE_DB, 'users', uid, 'posts', postId);

        const unsubscribe = onSnapshot(postRef, (postSnap) => {
          if (postSnap.exists()) {
            const postData = postSnap.data();
            setPost(postData);

            const comments = postData.comments || [];
            setComments(comments);

            const userHasLiked = postData.likes?.includes(FIREBASE_AUTH.currentUser?.uid || '');
            setLiked(userHasLiked || false);
          }
        });

        return () => unsubscribe();
      } catch (error) {
        console.error("Error fetching post data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [uid, postId]);
  

  const [commentUserDetails, setCommentUserDetails] = useState<{ [userId: string]: { username: string, avatar: string } }>({});
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  useEffect(() => {
    const fetchCommentUserDetails = async () => {
      const userDetails: { [userId: string]: { username: string, avatar: string } } = {};
      const uniqueUserIds = Array.from(new Set(comments.map(comment => comment.userId)));
  
      for (const userId of uniqueUserIds) {
        const userRef = doc(FIREBASE_DB, 'users', userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          userDetails[userId] = {
            username: userSnap.data()?.username || 'Unknown User',
            avatar: userSnap.data()?.photoUrl ,
          };
        }
      }
  
      setCommentUserDetails(userDetails);
    };
  
    fetchCommentUserDetails();
  }, [comments]);
  
  const createNotification = async (type: 'like' | 'comment', postOwnerId: string, fromUserId: string, postId: string, commentText: string) => {
    const notificationRef = collection(FIREBASE_DB, 'notifications');
    await addDoc(notificationRef, {
      userId: postOwnerId,
      type: type,
      postId: postId,
      fromUserId: fromUserId,
      timestamp: new Date().toISOString(),
      commentText: commentText,
    });
  };
  const handleGoToLikesScreen = () => {
    navigation.navigate('LikesScreen', {
      postId: postId,
      userId: uid,
    });
  };
  

  const handleComment = async () => {
    if (newComment.trim() && post) {
      const postRef = doc(FIREBASE_DB, 'users', uid, 'posts', postId);
      const commentId = new Date().getTime().toString(); 
      const comment = { id: commentId, userId: FIREBASE_AUTH.currentUser?.uid || '', text: newComment.trim() };
      setComments([...comments, comment]);
      await updateDoc(postRef, { comments: arrayUnion(comment) });
      await createNotification('comment', uid, FIREBASE_AUTH.currentUser?.uid || '', postId, newComment.trim());
      setNewComment('');
    }
  };
  
  
  
  const toggleCommentInput = () => {
    setShowCommentInput(!showCommentInput);
  };

  const openCommentModal = () => {
    setModalVisible(true);
  };

  const closeCommentModal = () => {
    setModalVisible(false);
  };
  
  
  
  const handleDeletePost = async () => {
    try {
      const postRef = doc(FIREBASE_DB, 'users', uid, 'posts', postId);
      const commentsRef = collection(postRef, 'comments');
      const likesRef = collection(postRef, 'likes');
      const notificationsRef = collection(FIREBASE_DB, 'notifications');

      Alert.alert('Delete Post', 'Are you sure you want to delete this post? This will also delete all associated comments and likes.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              const commentsSnapshot = await getDocs(query(commentsRef));
              commentsSnapshot.forEach(async (commentDoc) => {
                await deleteDoc(commentDoc.ref);
              });
  
              const likesSnapshot = await getDocs(query(likesRef));
              likesSnapshot.forEach(async (likeDoc) => {
                await deleteDoc(likeDoc.ref);
              });
              
            const notificationsSnapshot = await getDocs(
              query(notificationsRef, where('postId', '==', postId))
            );
            notificationsSnapshot.forEach(async (notificationDoc) => {
              await deleteDoc(notificationDoc.ref);
            });

            
            const storageRef = ref(FIREBASE_STORAGE, `users/${FIREBASE_AUTH.currentUser?.uid}/Posts/${postId}.jpg`);
            await deleteObject(storageRef);           
            await deleteDoc(postRef);
            },
          },
        ],
        { cancelable: true }
      );
    } catch (error) {
      console.error('Error deleting post:', error);
    }
  };
  const goToUserProfile = async () => {
    if (user) {
      try {
        const postsRef = collection(FIREBASE_DB, 'users', uid, 'posts');
        const postsSnapshot = await getDocs(postsRef);
  
        const userPosts: any[] = postsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
        navigation.navigate('UserProfile', {
          username: user.username,
          name: user.name,
          photoUrl: user.photoUrl,
          bio: user.bio,
          userId: uid,
          posts: userPosts, 
        });
      } catch (error) {
        console.error('Error fetching user posts:', error);
      }
    }
  };
  
  const deleteNotification = async (notificationId: string) => {
    try {
      const notificationRef = doc(FIREBASE_DB, 'notifications', notificationId);
      await deleteDoc(notificationRef);
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };
  const handleLike = async () => {
    if (post) {
      const postRef = doc(FIREBASE_DB, 'users', uid, 'posts', postId);
      const userId = FIREBASE_AUTH.currentUser?.uid || '';
      const userHasLiked = post.likes?.includes(userId) || false;
  
      const newLikes = userHasLiked
        ? post.likes?.filter(id => id !== userId)
        : [...(post.likes || []), userId];
  
      setLiked(!userHasLiked);
      await updateDoc(postRef, { likes: newLikes });
      setPost(prevPost => prevPost ? { ...prevPost, likes: newLikes } : null);
  
      if (userHasLiked) {
        const notificationsQuery = query(
          collection(FIREBASE_DB, 'notifications'),
          where('userId', '==', uid),
          where('type', '==', 'like'),
          where('postId', '==', postId),
          where('fromUserId', '==', userId)
        );
        const notificationsSnapshot = await getDocs(notificationsQuery);
        notificationsSnapshot.forEach(async (doc) => {
          await deleteNotification(doc.id);
        });
      } else {
        await createNotification('like', uid, userId, postId, '');
      }
    }
  };
  
  const handleDeleteComment = async (commentId: string) => {
    try {
      Alert.alert('Delete Comment', 'Are you sure you want to delete this comment?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              const postRef = doc(FIREBASE_DB, 'users', uid, 'posts', postId);
              
              const commentToRemove = comments.find(comment => comment.id === commentId);
              if (commentToRemove) {
                await updateDoc(postRef, {
                  comments: arrayRemove(commentToRemove),
                });
  
                setComments(prevComments => prevComments.filter(comment => comment.id !== commentId));                
                const notificationsQuery = query(
                  collection(FIREBASE_DB, 'notifications'),
                  where('userId', '==', uid),
                  where('type', '==', 'comment'),
                  where('postId', '==', postId),
                  where('fromUserId', '==', FIREBASE_AUTH.currentUser?.uid || '')
                );
                const notificationsSnapshot = await getDocs(notificationsQuery);
                notificationsSnapshot.forEach(async (doc) => {
                  await deleteNotification(doc.id);
                });
              }
            },
          },
        ],
        { cancelable: true }
      );
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };
  
  if (loading) {
    return;
  }
  
  else if (!user || !post) {
    return <Paragraph>No data found.</Paragraph>;
  }

  return (
    <Card 
    style={[styles.card]}>
         <TouchableOpacity onPress={goToUserProfile}>

<Card.Title
  title={user.username}
  left={(props) => <Avatar.Image {...props} source={{ uri: user.photoUrl }} />}
  right={(props) =>
    FIREBASE_AUTH.currentUser?.uid === uid && (
      <TouchableOpacity onPress={handleDeletePost} 
      style={{paddingRight: '3%'}}>
        <Ionicons name="ellipsis-horizontal" size={20} color="#0d0d0d" />
            </TouchableOpacity>
          )
        }
      />

      </TouchableOpacity>
      <View style={styles.imageContainer}>
        <Image source={{ uri: post.postImage }} style={styles.image} />
      </View>
      <View style={styles.interactions}>
        <TouchableOpacity onPress={handleLike}>
          <Text style={styles.likeButton}>
            {liked ? <Ionicons name="heart" size={29} color="#0D0D0D" /> : <Ionicons name="heart-outline" size={29} color="#0d0d0d" />}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={openCommentModal}>
          <Ionicons style={{ paddingRight: 10 }} name="chatbubble-outline" size={25} color="#0d0d0d" />
        </TouchableOpacity>

      </View>
      <Card.Content>
        <TouchableOpacity 
        onPress={handleGoToLikesScreen}
        >
        <Text style={{ fontWeight: 'bold', marginTop: 10 }}>
          {post.likes?.length > 0 ? `${post.likes.length} likes` : ''}
        </Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: post.likes?.length > 0 ? '-1%' : '-4%' }}>
          <TouchableOpacity>
            <Text style={{ fontWeight: 'bold', marginRight: '2%' }}>{user.username}</Text>
          </TouchableOpacity>
          <Paragraph style={styles.description}>{post.description}</Paragraph>
        </View>
      
          <View>
          {comments.length > 0 && (
          <View style={{flexDirection:'row' }}>
            <Text style={[styles.commentText]}>
              <TouchableOpacity  onPress={goToUserProfile}>
              <Text style={styles.commentUser}>
              {commentUserDetails[comments[comments.length - 1].userId]?.username}
              </Text> 
              </TouchableOpacity> <Text>{comments[comments.length - 1].text}</Text>
            </Text>
          </View>
        )}
        </View>
    
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={closeCommentModal}
        >
  <TouchableWithoutFeedback onPress={
    ()=>{
      Keyboard.dismiss();
    closeCommentModal();}}>
    <View style={styles.modalOverlay} />
        </TouchableWithoutFeedback>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContent}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0} 
        >
    
      <View style={{ flex: 1 }}>
        <Text style={styles.modalTitle}>Comments</Text>
        <FlatList
          data={comments}
          renderItem={({ item }) => (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: '2%' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Avatar.Image size={24} source={{ uri: commentUserDetails[item.userId]?.avatar }} />
                <Text style={{ fontSize: 14, marginLeft: 8 }}>
                  <TouchableOpacity onPress={() => {
                    closeCommentModal();
                    goToUserProfile();
                  }}>
                    <Text style={{ fontWeight: 'bold' }}>
                      {commentUserDetails[item.userId]?.username}
                    </Text>
                  </TouchableOpacity>
                  {` ${item.text}`}
                </Text>
              </View>
              {FIREBASE_AUTH.currentUser?.uid === item.userId && (
                <TouchableOpacity onPress={() => handleDeleteComment(item.id)}>
                  <Ionicons name="trash-outline" size={20} color="#d9534f" />
                </TouchableOpacity>
              )}
            </View>
          )}
          keyExtractor={(item, index) => index.toString()}
        />
        <View style={styles.commentInputContainer}>
          <TextInput
            style={[styles.commentInput, {marginBottom: keyboardVisible ? '3%' : '8%'}]}
            placeholder="Add a comment..."
            value={newComment}
            onChangeText={setNewComment}
            onSubmitEditing={handleComment}
          />
          {newComment.trim().length > 0 && (
            <TouchableOpacity onPress={handleComment} style={styles.submitButton}>
              <Ionicons name="arrow-forward" size={20} color="#0D0D0D" />
            </TouchableOpacity>
          )}
        </View>
      </View>
        </KeyboardAvoidingView>
      </Modal>

      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderWidth: 0, 
    marginVertical:2,
    shadowColor: 'rgba(0,0,0, 0.0)', 
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0 
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#f0f0f0',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  description: {
    marginVertical: 10,
  },
  interactions: {
    marginLeft: '2%',
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  likeButton: {
    fontSize: 18,
    paddingRight: 10,
  },
  commentInput: {
    padding: 8,
    width: '90%',
    marginTop: '1%',
    borderWidth: 1,
    borderRadius: 18,
    marginHorizontal:'auto',
    borderColor: '#E3E3E3',
 },
  
  commentText: {
    fontSize: 14,
    alignContent: 'center',
    alignItems: 'center',
  },
  commentUser: {
    fontWeight: 'bold',
    alignContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    height: '60%',
    position: 'absolute',
    bottom: 0,
    width: '100%',
  },
  submitButton: {
    alignItems: 'center',
    paddingLeft: 10,
    justifyContent: 'center',
    alignContent: 'center',
    marginBottom:'-3%'
  },
 
  commentInputContainer: {
    flexDirection: 'row', 
    alignContent: 'center', 
    alignItems: 'center',
    marginTop:'2%',
    justifyContent: 'space-between', 
    marginHorizontal:'auto', 
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    marginHorizontal:'auto',
  },
});

export default PostCard;