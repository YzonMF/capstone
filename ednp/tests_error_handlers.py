import json
from unittest.mock import patch

from django.core.exceptions import PermissionDenied, SuspiciousOperation
from django.template.exceptions import TemplateDoesNotExist
from django.test import Client, RequestFactory, TestCase, override_settings

from ednp.views import csrf_failure, handler400, handler403, handler404, handler500


class ErrorHandlersUnitTest(TestCase):
    def setUp(self):
        self.factory = RequestFactory()

    def test_handler500_html_response(self):
        request = self.factory.get('/some-broken-page')
        response = handler500(request)

        self.assertEqual(response.status_code, 500)
        content = response.content.decode('utf-8')
        self.assertIn('Something Went Wrong', content)
        self.assertIn('EDNP Portal Notice', content)
        self.assertNotIn('Traceback (most recent call last)', content)
        self.assertNotIn('Server Error (500)', content)

    def test_handler500_ajax_json_response(self):
        request = self.factory.get('/some-api-endpoint', HTTP_X_REQUESTED_WITH='XMLHttpRequest')
        response = handler500(request)

        self.assertEqual(response.status_code, 500)
        self.assertEqual(response['Content-Type'], 'application/json')
        data = json.loads(response.content.decode('utf-8'))
        self.assertEqual(data.get('ok'), False)
        self.assertEqual(data.get('error'), 'An unexpected server error occurred. Please try again later.')

    def test_handler500_accept_json_response(self):
        request = self.factory.get('/some-api-endpoint', HTTP_ACCEPT='application/json')
        response = handler500(request)

        self.assertEqual(response.status_code, 500)
        self.assertEqual(response['Content-Type'], 'application/json')
        data = json.loads(response.content.decode('utf-8'))
        self.assertEqual(data.get('ok'), False)

    def test_handler500_fallback_if_template_fails(self):
        request = self.factory.get('/crash')
        with patch('django.template.loader.get_template', side_effect=TemplateDoesNotExist('500.html')):
            response = handler500(request)

        self.assertEqual(response.status_code, 500)
        content = response.content.decode('utf-8')
        self.assertIn('Something Went Wrong', content)
        self.assertNotIn('Traceback', content)

    def test_handler404_html_response(self):
        request = self.factory.get('/nonexistent-page-url')
        response = handler404(request)

        self.assertEqual(response.status_code, 404)
        content = response.content.decode('utf-8')
        self.assertIn('Page Not Found', content)
        self.assertNotIn('Using the URLconf defined in', content)

    def test_handler404_ajax_response(self):
        request = self.factory.get('/nonexistent-api', HTTP_X_REQUESTED_WITH='XMLHttpRequest')
        response = handler404(request)

        self.assertEqual(response.status_code, 404)
        data = json.loads(response.content.decode('utf-8'))
        self.assertEqual(data.get('ok'), False)
        self.assertEqual(data.get('error'), 'The requested resource was not found.')

    def test_handler403_html_response(self):
        request = self.factory.get('/forbidden-page')
        response = handler403(request)

        self.assertEqual(response.status_code, 403)
        content = response.content.decode('utf-8')
        self.assertIn('Access Denied', content)

    def test_handler403_ajax_response(self):
        request = self.factory.get('/forbidden-api', HTTP_X_REQUESTED_WITH='XMLHttpRequest')
        response = handler403(request)

        self.assertEqual(response.status_code, 403)
        data = json.loads(response.content.decode('utf-8'))
        self.assertEqual(data.get('ok'), False)
        self.assertEqual(data.get('error'), 'You do not have permission to access this resource.')

    def test_handler400_html_response(self):
        request = self.factory.get('/bad-request-url')
        response = handler400(request)

        self.assertEqual(response.status_code, 400)
        content = response.content.decode('utf-8')
        self.assertIn('Bad Request', content)

    def test_handler400_ajax_response(self):
        request = self.factory.get('/bad-api', HTTP_X_REQUESTED_WITH='XMLHttpRequest')
        response = handler400(request)

        self.assertEqual(response.status_code, 400)
        data = json.loads(response.content.decode('utf-8'))
        self.assertEqual(data.get('ok'), False)
        self.assertEqual(data.get('error'), 'Bad request.')

    def test_csrf_failure_html_response(self):
        request = self.factory.post('/some-post-target')
        response = csrf_failure(request, reason='CSRF token missing')

        self.assertEqual(response.status_code, 403)
        content = response.content.decode('utf-8')
        self.assertIn('Session or Security Token Expired', content)

    def test_csrf_failure_ajax_response(self):
        request = self.factory.post('/api-post', HTTP_X_REQUESTED_WITH='XMLHttpRequest')
        response = csrf_failure(request, reason='CSRF token missing')

        self.assertEqual(response.status_code, 403)
        data = json.loads(response.content.decode('utf-8'))
        self.assertEqual(data.get('ok'), False)
        self.assertIn('Session expired', data.get('error', ''))


@override_settings(DEBUG=False)
class ErrorHandlersIntegrationTest(TestCase):
    def setUp(self):
        self.client = Client(raise_request_exception=False)

    def test_404_page_rendered_on_invalid_route(self):
        response = self.client.get('/definitely-invalid-route-12345/')
        self.assertEqual(response.status_code, 404)
        content = response.content.decode('utf-8')
        self.assertIn('Page Not Found', content)
        self.assertNotIn('Using the URLconf', content)
        self.assertNotIn('Traceback', content)

    def test_500_page_rendered_on_unhandled_view_exception(self):
        with patch('ednp.views.render', side_effect=RuntimeError('Database crashed')):
            response = self.client.get('/')

        self.assertEqual(response.status_code, 500)
        content = response.content.decode('utf-8')
        self.assertIn('Something Went Wrong', content)
        self.assertNotIn('Database crashed', content)
        self.assertNotIn('Traceback (most recent call last)', content)
        self.assertNotIn('Server Error (500)', content)

    def test_500_ajax_json_rendered_on_unhandled_view_exception(self):
        with patch('ednp.views.render', side_effect=RuntimeError('Unexpected failure')):
            response = self.client.get('/', HTTP_X_REQUESTED_WITH='XMLHttpRequest')

        self.assertEqual(response.status_code, 500)
        data = json.loads(response.content.decode('utf-8'))
        self.assertEqual(data.get('ok'), False)
        self.assertNotIn('Unexpected failure', data.get('error', ''))
