export class Result {
 static ok(data = null) {
 return {
 success: true,
 data,
 error: null
 };
 }
 static fail(error) {
 return {
 success: false,
 data: null,
 error
 };
 }
}
