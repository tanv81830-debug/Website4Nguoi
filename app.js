import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  getFirestore, collection, addDoc, query, orderBy, onSnapshot,
  serverTimestamp, doc, getDoc, setDoc, updateDoc, where, limit
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import {getStorage,ref,uploadBytes,getDownloadURL} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-storage.js";
import {firebaseConfig} from "./firebase-config.js";

const app=initializeApp(firebaseConfig);
export const auth=getAuth(app);
export const db=getFirestore(app);
export const storage=getStorage(app);
export const watchAuth=cb=>onAuthStateChanged(auth,cb);

export async function registerUser(name,email,password){
  const clean=name.trim(), cleanEmail=email.trim().toLowerCase();
  if(!clean) throw new Error('Họ tên không được để trống.');
  const r=await createUserWithEmailAndPassword(auth,cleanEmail,password);
  await updateProfile(r.user,{displayName:clean});
  await setDoc(doc(db,'profiles',r.user.uid),{uid:r.user.uid,name:clean,email:r.user.email,birthday:'',bio:'',className:'B3',avatarUrl:'',role:'member',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
  return r.user;
}

export async function getProfile(uid=auth.currentUser?.uid){
  if(!uid) return null;
  const s=await getDoc(doc(db,'profiles',uid));
  return s.exists()?s.data():null;
}

export async function isAdminUser(){
  if(!auth.currentUser) return false;
  const p=await getProfile();
  return p?.role==='admin';
}

export async function loginUser(name,email,password){
  const clean=name.trim(), cleanEmail=email.trim().toLowerCase();
  if(!clean) throw new Error('Phải nhập họ tên.');
  const r=await signInWithEmailAndPassword(auth,cleanEmail,password);
  const p=await getProfile(r.user.uid);
  const exactName=(p?.name||r.user.displayName||'').trim();
  const exactEmail=(p?.email||r.user.email||'').trim().toLowerCase();
  if(exactName!==clean || exactEmail!==cleanEmail){
    await signOut(auth);
    throw new Error('Họ tên hoặc email không đúng với tài khoản đã đăng ký.');
  }
  return r.user;
}

export const logoutUser=()=>signOut(auth);

export async function getOwnProfile(){
  const p=await getProfile();
  if(!p) throw new Error('Chưa đăng nhập.');
  return p;
}

export async function updateOwnProfile(data,exactName){
  const p=await getOwnProfile();
  if(p.name.trim()!==exactName.trim()) throw new Error('Họ tên xác thực không đúng.');
  const safe={uid:p.uid,name:p.name,email:p.email,birthday:(data.birthday||'').trim(),bio:(data.bio||'').trim(),className:(data.className||'B3').trim(),avatarUrl:data.avatarUrl||p.avatarUrl||'',role:p.role||'member',updatedAt:serverTimestamp()};
  await submitProfileChangeRequest({
    birthday:safe.birthday,
    bio:safe.bio,
    className:safe.className
  });
  return {...safe,pendingApproval:true};
}

export async function uploadOwnAvatar(file,exactName){
  const p=await getOwnProfile();
  if(p.name.trim()!==exactName.trim()) throw new Error('Họ tên xác thực không đúng.');
  if(!file||!file.type.startsWith('image/')) throw new Error('Chỉ được chọn file ảnh.');
  if(file.size>5*1024*1024) throw new Error('Ảnh phải nhỏ hơn 5MB.');
  const r=ref(storage,`avatars/${p.uid}/${Date.now()}-${file.name}`);
  await uploadBytes(r,file);
  const url=await getDownloadURL(r);
  await updateDoc(doc(db,'profiles',p.uid),{avatarUrl:url,updatedAt:serverTimestamp()});
  return url;
}

export async function adminUploadCover(file){
  if(!(await isAdminUser())) throw new Error('Bạn chưa được cấp quyền admin.');
  if(!file||!file.type.startsWith('image/')) throw new Error('Chỉ được chọn file ảnh.');
  if(file.size>10*1024*1024) throw new Error('Ảnh lớp phải nhỏ hơn 10MB.');
  const r=ref(storage,`site/class-cover-${Date.now()}`);
  await uploadBytes(r,file);
  const url=await getDownloadURL(r);
  await setDoc(doc(db,'siteSettings','home'),{coverUrl:url,updatedAt:serverTimestamp(),updatedBy:auth.currentUser.uid},{merge:true});
  return url;
}

export function watchSiteSettings(cb){
  return onSnapshot(doc(db,'siteSettings','home'),s=>cb(s.exists()?s.data():{}));
}

export async function sendMessage(toUid,text){
  if(!auth.currentUser) throw new Error('Chưa đăng nhập.');
  const clean=(text||'').trim();
  if(!clean) return;
  const cid=[auth.currentUser.uid,toUid].sort().join('_');
  const payload={senderUid:auth.currentUser.uid,receiverUid:toUid,text:clean,createdAt:serverTimestamp(),conversationId:cid};
  await addDoc(collection(db,'conversations',cid,'messages'),payload);
  await addDoc(collection(db,'adminInbox'),payload);
}

export function watchConversation(toUid,cb){
  if(!auth.currentUser) return ()=>{};
  const cid=[auth.currentUser.uid,toUid].sort().join('_');
  const q=query(collection(db,'conversations',cid,'messages'),orderBy('createdAt','asc'));
  return onSnapshot(q,s=>cb(s.docs.map(d=>({id:d.id,...d.data()}))));
}

export function watchAdminInbox(cb){
  const q=query(collection(db,'adminInbox'),orderBy('createdAt','desc'),limit(100));
  return onSnapshot(q,s=>cb(s.docs.map(d=>({id:d.id,...d.data()}))));
}

export async function adminDeleteMessage(messageId){
  if(!(await isAdminUser())) throw new Error('Không có quyền admin.');
  // Admin inbox deletion uses the Firestore rules/Cloud Function for production.
  // The dashboard intentionally does not expose client-side deletion of conversation data.
  throw new Error('Đã khóa xóa tin nhắn ở client để tránh xóa nhầm.');
}

export async function getMyProfile(uid = auth.currentUser?.uid) {
  if (!uid) return null;
  const snap = await getDoc(doc(db, "profiles", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export function isAdminRole(role) {
  return role === "admin" || role === "superadmin";
}

export function isSuperAdminRole(role) {
  return role === "superadmin";
}

export async function getProfile(uid = auth.currentUser?.uid) {
  if (!uid) return null;
  const s = await getDoc(doc(db, "profiles", uid));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

export async function uploadMemberPhoto(file, uid, filename) {
  if (!auth.currentUser || auth.currentUser.uid !== uid) throw new Error("Bạn chưa đăng nhập đúng tài khoản.");
  if (!file) throw new Error("Chưa chọn ảnh.");
  if (!file.type.startsWith("image/")) throw new Error("Chỉ được chọn file ảnh.");
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const r = ref(storage, `users/${uid}/pending-profile/${Date.now()}_${safe}`);
  await uploadBytes(r, file, { contentType: file.type });
  const url = await getDownloadURL(r);
  await submitProfileChangeRequest({photoUrl:url, photoPath:r.fullPath});
  return url;
}

export async function adminUploadMemberPhoto(file, uid, filename) {
  if (!(await isAdminUser())) throw new Error("Bạn chưa được cấp quyền Admin.");
  if (!uid) throw new Error("Thiếu UID thành viên.");
  if (!file || !file.type.startsWith("image/")) throw new Error("Chỉ được chọn file ảnh.");
  const safe = (filename || file.name).replace(/[^a-zA-Z0-9._-]/g, "_");
  const r = ref(storage, `users/${uid}/profile/admin-${Date.now()}_${safe}`);
  await uploadBytes(r, file, {contentType:file.type});
  const url = await getDownloadURL(r);
  await setDoc(doc(db,"profiles",uid),{photoUrl:url,photoUpdatedAt:serverTimestamp(),photoUpdatedBy:auth.currentUser.uid},{merge:true});
  return url;
}

export function watchMembers(callback){
  const q=query(collection(db,"profiles"),orderBy("name","asc"));
  return onSnapshot(q,s=>callback(s.docs.map(d=>({id:d.id,...d.data()}))));
}
export function watchAdmins(callback){
  const q=query(collection(db,"profiles"),where("role","in",["admin","superadmin"]),orderBy("name","asc"));
  return onSnapshot(q,s=>callback(s.docs.map(d=>({id:d.id,...d.data()}))));
}

export async function uploadClassActivityPhoto(file, title, uid) {
  if (!auth.currentUser || auth.currentUser.uid !== uid) throw new Error("Bạn chưa đăng nhập.");
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const r = ref(storage, `class-activities/${Date.now()}_${safe}`);
  await uploadBytes(r, file, { contentType: file.type });
  const url = await getDownloadURL(r);
  await addDoc(collection(db, "classActivities"), {
    title: title?.trim() || "Hoạt động B3",
    url,
    storagePath: r.fullPath,
    uploaderUid: uid,
    createdAt: serverTimestamp()
  });
  return url;
}

export function watchClassActivities(callback) {
  const q = query(collection(db, "classActivities"), orderBy("createdAt", "desc"));
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({id:d.id, ...d.data()}))));
}

export async function submitProfileChangeRequest(changes) {
  if (!auth.currentUser) throw new Error("Bạn chưa đăng nhập.");
  return addDoc(collection(db, "profileRequests"), {
    uid: auth.currentUser.uid,
    changes,
    status: "pending",
    createdAt: serverTimestamp()
  });
}

export function watchMyProfileRequests(callback) {
  if (!auth.currentUser) return () => {};
  const q = query(
    collection(db, "profileRequests"),
    where("uid", "==", auth.currentUser.uid),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, s => callback(s.docs.map(d => ({id:d.id, ...d.data()}))));
}

export function watchPendingProfileRequests(callback) {
  const q = query(
    collection(db, "profileRequests"),
    where("status", "==", "pending"),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, s => callback(s.docs.map(d => ({id:d.id, ...d.data()}))));
}

export async function approveProfileRequest(requestId, requestData, approvedChanges) {
  if (!auth.currentUser) throw new Error("Chưa đăng nhập.");
  await setDoc(doc(db, "profiles", requestData.uid), approvedChanges, { merge: true });
  await setDoc(doc(db, "profileRequests", requestId), {
    status: "approved",
    approvedBy: auth.currentUser.uid,
    approvedAt: serverTimestamp()
  }, { merge: true });
}

export async function rejectProfileRequest(requestId) {
  if (!auth.currentUser) throw new Error("Chưa đăng nhập.");
  await setDoc(doc(db, "profileRequests", requestId), {
    status: "rejected",
    rejectedBy: auth.currentUser.uid,
    rejectedAt: serverTimestamp()
  }, { merge: true });
}